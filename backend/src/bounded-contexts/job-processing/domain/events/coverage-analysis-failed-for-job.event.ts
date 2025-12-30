import { IDomainEvent } from '../../../../shared/kernel/domain-event.interface';

export class CoverageAnalysisFailedForJobEvent implements IDomainEvent {
  readonly eventName = 'job-processing.coverage-analysis-failed';
  readonly occurredOn: Date;

  constructor(
    public readonly jobId: string,
    public readonly error: string,
  ) {
    this.occurredOn = new Date();
  }
}
