import { IDomainEvent } from '../../../../shared/kernel/domain-event.interface';
import { JobId } from '../models/job-id.value-object';

export class JobCompletedEvent implements IDomainEvent {
  readonly eventName = 'job.completed';
  readonly occurredOn: Date;

  constructor(
    public readonly jobId: JobId,
  ) {
    this.occurredOn = new Date();
  }
}
