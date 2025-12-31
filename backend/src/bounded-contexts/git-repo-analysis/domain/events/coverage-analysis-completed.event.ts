import { IDomainEvent } from '@/shared/kernel/domain-event.interface';
import { GitRepoId } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo-id.value-object';

export class CoverageAnalysisCompletedEvent implements IDomainEvent {
  readonly eventName = 'coverage-analysis.completed';
  readonly occurredOn: Date;

  constructor(
    public readonly repositoryId: GitRepoId,
    public readonly totalFiles: number,
    public readonly averageCoverage: number,
  ) {
    this.occurredOn = new Date();
  }
}
