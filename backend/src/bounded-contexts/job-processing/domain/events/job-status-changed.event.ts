import { IDomainEvent } from '@/shared/kernel/domain-event.interface';
import { JobId } from '@/bounded-contexts/job-processing/domain/models/job-id.value-object';
import { JobStatus } from '@/bounded-contexts/job-processing/domain/models/job-status.enum';

export class JobStatusChangedEvent implements IDomainEvent {
  readonly eventName = 'job.status.changed';
  readonly occurredOn: Date;

  constructor(
    public readonly jobId: JobId,
    public readonly previousStatus: JobStatus,
    public readonly newStatus: JobStatus,
  ) {
    this.occurredOn = new Date();
  }
}
