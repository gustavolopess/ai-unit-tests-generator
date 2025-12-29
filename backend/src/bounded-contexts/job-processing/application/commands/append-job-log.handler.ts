import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { AppendJobLogCommand } from './append-job-log.command';
import { JobLogService } from '../../infrastructure/job-log.service';
import type { IJobRepository } from '../../domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '../../domain/repositories/job.repository.interface';
import { JobId } from '../../domain/models/job-id.value-object';

@CommandHandler(AppendJobLogCommand)
export class AppendJobLogHandler
  implements ICommandHandler<AppendJobLogCommand>
{
  private readonly logger = new Logger(AppendJobLogHandler.name);

  constructor(
    private readonly jobLogService: JobLogService,
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
  ) {}

  async execute(command: AppendJobLogCommand): Promise<void> {
    const { jobId, message } = command;

    try {
      // Write to log file
      await this.jobLogService.appendLog(jobId, message);

      // Set log_path in database on first log (if not already set)
      const job = await this.jobRepository.findById(JobId.create(jobId));
      if (job && !job.logPath) {
        const logPath = this.jobLogService.getLogPath(jobId);
        job.setLogPath(logPath);
        await this.jobRepository.save(job);
        this.logger.debug(`Set log_path for job ${jobId}: ${logPath}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to append log for job ${jobId}: ${error.message}`,
      );
      // Don't throw - logging failures shouldn't fail the job
    }
  }
}
