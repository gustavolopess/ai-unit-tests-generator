import { IDomainEvent } from '@/shared/kernel/domain-event.interface';

export class PRCreationFailedForJobEvent implements IDomainEvent {
  readonly eventName = 'job-processing.pr-creation-failed';
  readonly occurredOn: Date;

  constructor(
    public readonly jobId: string,
    public readonly error: string,
  ) {
    this.occurredOn = new Date();
  }
}
