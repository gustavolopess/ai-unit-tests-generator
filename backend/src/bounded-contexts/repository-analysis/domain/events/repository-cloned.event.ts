import { IDomainEvent } from '../../../../shared/kernel/domain-event.interface';
import { RepositoryId } from '../models/repository-id.value-object';
import { RepositoryUrl } from '../models/repository-url.value-object';

export class RepositoryClonedEvent implements IDomainEvent {
  readonly eventName = 'repository.cloned';
  readonly occurredOn: Date;

  constructor(
    public readonly repositoryId: RepositoryId,
    public readonly repositoryUrl: RepositoryUrl,
    public readonly localPath: string,
  ) {
    this.occurredOn = new Date();
  }
}
