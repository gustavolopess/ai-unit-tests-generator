import { JobStatus } from '../../domain/models/job-status.enum';

export class UpdateJobStatusCommand {
  constructor(
    public readonly jobId: string,
    public readonly status: JobStatus,
  ) {}
}
