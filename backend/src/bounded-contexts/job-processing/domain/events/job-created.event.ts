import { IDomainEvent } from '../../../../shared/kernel/domain-event.interface';
import { JobId } from '../models/job-id.value-object';

export class JobCreatedEvent implements IDomainEvent {
  readonly eventName = 'job.created';
  readonly occurredOn: Date;

  constructor(
    public readonly jobId: JobId,
    public readonly repositoryUrl: string,
  ) {
    this.occurredOn = new Date();
  }
}
