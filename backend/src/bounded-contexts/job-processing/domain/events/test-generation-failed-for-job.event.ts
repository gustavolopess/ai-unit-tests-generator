import { IDomainEvent } from '@/shared/kernel/domain-event.interface';

export class TestGenerationFailedForJobEvent implements IDomainEvent {
  readonly eventName = 'job-processing.test-generation-failed';
  readonly occurredOn: Date;

  constructor(
    public readonly jobId: string,
    public readonly error: string,
  ) {
    this.occurredOn = new Date();
  }
}
