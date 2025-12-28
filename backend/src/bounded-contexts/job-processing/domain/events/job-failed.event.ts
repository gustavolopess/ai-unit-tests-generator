import { IDomainEvent } from '../../../../shared/kernel/domain-event.interface';
import { JobId } from '../models/job-id.value-object';

export class JobFailedEvent implements IDomainEvent {
  readonly eventName = 'job.failed';
  readonly occurredOn: Date;

  constructor(
    public readonly jobId: JobId,
    public readonly error: string,
  ) {
    this.occurredOn = new Date();
  }
}
