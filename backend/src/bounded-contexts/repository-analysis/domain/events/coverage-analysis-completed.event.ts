import { IDomainEvent } from '../../../../shared/kernel/domain-event.interface';
import { RepositoryId } from '../models/repository-id.value-object';

export class CoverageAnalysisCompletedEvent implements IDomainEvent {
  readonly eventName = 'coverage-analysis.completed';
  readonly occurredOn: Date;

  constructor(
    public readonly repositoryId: RepositoryId,
    public readonly totalFiles: number,
    public readonly averageCoverage: number,
  ) {
    this.occurredOn = new Date();
  }
}
