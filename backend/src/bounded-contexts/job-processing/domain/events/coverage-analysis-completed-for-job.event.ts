import { IDomainEvent } from '@/shared/kernel/domain-event.interface';

export class CoverageAnalysisCompletedForJobEvent implements IDomainEvent {
  readonly eventName = 'job-processing.coverage-analysis-completed';
  readonly occurredOn: Date;

  constructor(public readonly jobId: string) {
    this.occurredOn = new Date();
  }
}
