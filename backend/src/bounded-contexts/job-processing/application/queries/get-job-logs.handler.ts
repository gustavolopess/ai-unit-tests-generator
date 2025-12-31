import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { GetJobLogsQuery } from './get-job-logs.query';
import { JobLogService } from '@/bounded-contexts/job-processing/infrastructure/job-log.service';

@QueryHandler(GetJobLogsQuery)
export class GetJobLogsHandler implements IQueryHandler<GetJobLogsQuery> {
  private readonly logger = new Logger(GetJobLogsHandler.name);

  constructor(private readonly jobLogService: JobLogService) {}

  async execute(query: GetJobLogsQuery): Promise<string[]> {
    const { jobId } = query;

    try {
      const logs = await this.jobLogService.readLogs(jobId);
      return logs;
    } catch (error) {
      this.logger.error(
        `Failed to read logs for job ${jobId}: ${error.message}`,
      );
      return [];
    }
  }
}
