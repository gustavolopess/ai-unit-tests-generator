import { IDomainEvent } from '@/shared/kernel/domain-event.interface';
import { GitRepoId } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo-id.value-object';
import { GitRepoUrl } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo-url.value-object';

export class GitRepoClonedEvent implements IDomainEvent {
  readonly eventName = 'git-repo.cloned';
  readonly occurredOn: Date;

  constructor(
    public readonly gitRepoId: GitRepoId,
    public readonly gitRepoUrl: GitRepoUrl,
    public readonly localPath: string,
  ) {
    this.occurredOn = new Date();
  }
}
