import { IDomainEvent } from '../../../../shared/kernel/domain-event.interface';
import { TestGenerationId } from '../models/test-generation-id.value-object';

export class PullRequestCreatedEvent implements IDomainEvent {
  readonly eventName = 'pull-request.created';
  readonly occurredOn: Date;

  constructor(
    public readonly testGenerationId: TestGenerationId,
    public readonly repositoryId: string,
    public readonly prUrl: string,
    public readonly prNumber: number,
  ) {
    this.occurredOn = new Date();
  }
}
