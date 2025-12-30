import { CommandHandler, ICommandHandler, CommandBus, EventBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { AnalyzeCoverageForJobCommand } from './analyze-coverage-for-job.command';
import type { IJobRepository } from '../../domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '../../domain/repositories/job.repository.interface';
import { JobStatus } from '../../domain/models/job-status.enum';
import { AnalyzeCoverageCommand } from '../../../repository-analysis/application/commands';
import { AppendJobLogCommand, SetCoverageResultCommand } from './';
import { FileCoverageDto } from '../dto/job-response.dto';
import { CoverageAnalysisCompletedForJobEvent, CoverageAnalysisFailedForJobEvent } from '../../domain/events';

@CommandHandler(AnalyzeCoverageForJobCommand)
export class AnalyzeCoverageForJobHandler
  implements ICommandHandler<AnalyzeCoverageForJobCommand>
{
  private readonly logger = new Logger(AnalyzeCoverageForJobHandler.name);
  private readonly coverageThreshold: number = 80;

  constructor(
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
    private readonly commandBus: CommandBus,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: AnalyzeCoverageForJobCommand): Promise<void> {
    const { jobId } = command;

    this.logger.log(`Analyzing coverage for job ${jobId}`);

    try {
      // Get job
      const job = await this.jobRepository.findById(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      // Update status
      job.updateStatus(JobStatus.ANALYZING);
      await this.jobRepository.save(job);

      // Log
      await this.commandBus.execute(
        new AppendJobLogCommand(jobId, 'Starting Claude coverage analysis...'),
      );

      // Execute coverage analysis in Repository Analysis context
      const analyzedRepository = await this.commandBus.execute(
        new AnalyzeCoverageCommand(
          job.repositoryId,
          job.entrypoint,
          async (output: string) => {
            await this.commandBus.execute(new AppendJobLogCommand(jobId, output));
          },
        ),
      );

      await this.commandBus.execute(
        new AppendJobLogCommand(
          jobId,
          'Coverage analysis completed, processing results...',
        ),
      );

      // Convert to DTO format
      const fileCoverages: FileCoverageDto[] = analyzedRepository.fileCoverages.map(
        (fc) => ({
          file: fc.filePath,
          coverage: fc.coveragePercentage,
          needsImprovement: fc.coveragePercentage < this.coverageThreshold,
        }),
      );

      const result = this.buildCoverageResult(fileCoverages);

      // Save coverage result to job
      await this.commandBus.execute(
        new SetCoverageResultCommand(jobId, result),
      );

      await this.commandBus.execute(
        new AppendJobLogCommand(
          jobId,
          `Coverage analysis complete: ${result.totalFiles} files, ${result.averageCoverage}% average coverage`,
        ),
      );

      // Refresh job to get the updated coverage result
      const updatedJob = await this.jobRepository.findById(jobId);
      if (!updatedJob) {
        throw new Error(`Job ${jobId} not found after setting coverage result`);
      }

      // Update job status
      updatedJob.updateStatus(JobStatus.ANALYSIS_COMPLETED);
      await this.jobRepository.save(updatedJob);

      this.logger.log(`Coverage analysis completed for job ${jobId}`);

      // Publish event to trigger next step in saga
      this.eventBus.publish(new CoverageAnalysisCompletedForJobEvent(jobId));
    } catch (error) {
      this.logger.error(`Failed to analyze coverage for job ${jobId}: ${error.message}`);
      await this.commandBus.execute(
        new AppendJobLogCommand(jobId, `ERROR: ${error.message}`),
      );

      // Publish failure event to trigger saga error handling
      this.eventBus.publish(new CoverageAnalysisFailedForJobEvent(jobId, error.message));
      throw error;
    }
  }

  private buildCoverageResult(files: FileCoverageDto[]): {
    totalFiles: number;
    averageCoverage: number;
    files: FileCoverageDto[];
  } {
    const totalFiles = files.length;
    const averageCoverage =
      totalFiles > 0
        ? files.reduce((sum, file) => sum + file.coverage, 0) / totalFiles
        : 0;

    return {
      totalFiles,
      averageCoverage: Math.round(averageCoverage * 100) / 100,
      files,
    };
  }
}
