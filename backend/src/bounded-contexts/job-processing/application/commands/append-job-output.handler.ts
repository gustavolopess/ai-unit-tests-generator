import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { AppendJobOutputCommand } from './append-job-output.command';
import { JobLogService } from '@/bounded-contexts/job-processing/infrastructure/job-log.service';

/**
 * @deprecated Use AppendJobLogCommand instead
 * This handler is kept for backward compatibility and delegates to JobLogService
 */
@CommandHandler(AppendJobOutputCommand)
export class AppendJobOutputHandler implements ICommandHandler<AppendJobOutputCommand> {
  private readonly logger = new Logger(AppendJobOutputHandler.name);

  constructor(private readonly jobLogService: JobLogService) {}

  async execute(command: AppendJobOutputCommand): Promise<void> {
    const { jobId, output } = command;

    try {
      await this.jobLogService.appendLog(jobId, output);
    } catch (error) {
      this.logger.error(
        `Failed to append output for job ${jobId}: ${error.message}`,
      );
      // Don't throw - logging failures shouldn't fail the job
    }
  }
}
