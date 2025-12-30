import { IDomainEvent } from '../../../../shared/kernel/domain-event.interface';

export class PRCreatedForJobEvent implements IDomainEvent {
  readonly eventName = 'job-processing.pr-created';
  readonly occurredOn: Date;

  constructor(
    public readonly jobId: string,
  ) {
    this.occurredOn = new Date();
  }
}
