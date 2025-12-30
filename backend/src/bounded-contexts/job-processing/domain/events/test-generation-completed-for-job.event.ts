import { IDomainEvent } from '../../../../shared/kernel/domain-event.interface';

export class TestGenerationCompletedForJobEvent implements IDomainEvent {
  readonly eventName = 'job-processing.test-generation-completed';
  readonly occurredOn: Date;

  constructor(
    public readonly jobId: string,
  ) {
    this.occurredOn = new Date();
  }
}
