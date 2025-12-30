import { CommandHandler, ICommandHandler, CommandBus, QueryBus, EventBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { GenerateTestsForJobCommand } from './generate-tests-for-job.command';
import type { IJobRepository } from '../../domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '../../domain/repositories/job.repository.interface';
import { JobStatus } from '../../domain/models/job-status.enum';
import { GenerateTestsCommand } from '../../../test-generation/application/commands';
import { GetRepositoryQuery } from '../../../repository-analysis/application/queries';
import { AppendJobLogCommand, SetTestGenerationDataCommand } from './';
import { TestGenerationCompletedForJobEvent, TestGenerationFailedForJobEvent } from '../../domain/events';

@CommandHandler(GenerateTestsForJobCommand)
export class GenerateTestsForJobHandler
  implements ICommandHandler<GenerateTestsForJobCommand>
{
  private readonly logger = new Logger(GenerateTestsForJobHandler.name);

  constructor(
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: GenerateTestsForJobCommand): Promise<void> {
    const { jobId } = command;

    this.logger.log(`Checking if test generation needed for job ${jobId}`);

    try {
      // Get job
      const job = await this.jobRepository.findById(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      // Check if test generation is needed
      if (!job.needsTestGeneration()) {
        this.logger.log(`Job ${jobId} does not need test generation, skipping`);
        // If no test generation needed, check if we should create PR or complete
        if (job.needsPRCreation()) {
          // This will be handled by another saga step
          return;
        }
        // Complete the job
        job.updateStatus(JobStatus.COMPLETED);
        await this.jobRepository.save(job);
        return;
      }

      // Update status
      job.updateStatus(JobStatus.GENERATING_TESTS);
      await this.jobRepository.save(job);

      // Log
      await this.commandBus.execute(
        new AppendJobLogCommand(
          jobId,
          `Starting test generation for ${job.targetFilePath}...`,
        ),
      );

      // Get repository
      const repository = await this.queryBus.execute(
        new GetRepositoryQuery(job.repositoryId),
      );

      const workDir = job.entrypoint
        ? `${job.repositoryPath}/${job.entrypoint}`
        : job.repositoryPath!;

      // Execute test generation
      const testGenerationRequest = await this.commandBus.execute(
        new GenerateTestsCommand(
          repository.url.getValue(),
          workDir,
          job.targetFilePath!,
          async (output: string) => {
            await this.commandBus.execute(new AppendJobLogCommand(jobId, output));
          },
        ),
      );

      if (testGenerationRequest.sessionId) {
        await this.commandBus.execute(
          new AppendJobLogCommand(
            jobId,
            `Session ID saved: ${testGenerationRequest.sessionId}`,
          ),
        );
      }

      await this.commandBus.execute(
        new AppendJobLogCommand(jobId, 'Test generation completed successfully'),
      );

      // Save test generation data
      await this.commandBus.execute(
        new SetTestGenerationDataCommand(
          jobId,
          testGenerationRequest.sessionId,
          testGenerationRequest.id.getValue(),
          {
            filePath: job.targetFilePath!,
            testFilePath: testGenerationRequest.testFilePath,
            coverage: testGenerationRequest.coverage,
          },
        ),
      );

      // Update job status
      job.updateStatus(JobStatus.TEST_GENERATION_COMPLETED);
      await this.jobRepository.save(job);

      this.logger.log(`Test generation completed for job ${jobId}`);

      // Publish event to trigger next step in saga
      this.eventBus.publish(new TestGenerationCompletedForJobEvent(jobId));
    } catch (error) {
      this.logger.error(`Failed to generate tests for job ${jobId}: ${error.message}`);
      await this.commandBus.execute(
        new AppendJobLogCommand(jobId, `ERROR: ${error.message}`),
      );

      // Publish failure event to trigger saga error handling
      this.eventBus.publish(new TestGenerationFailedForJobEvent(jobId, error.message));
      throw error;
    }
  }
}
