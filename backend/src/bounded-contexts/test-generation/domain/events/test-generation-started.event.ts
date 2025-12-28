import { IDomainEvent } from '../../../../shared/kernel/domain-event.interface';
import { TestGenerationId } from '../models/test-generation-id.value-object';

export class TestGenerationStartedEvent implements IDomainEvent {
  readonly eventName = 'test-generation.started';
  readonly occurredOn: Date;

  constructor(
    public readonly testGenerationId: TestGenerationId,
    public readonly repositoryId: string,
    public readonly targetFilePath: string,
  ) {
    this.occurredOn = new Date();
  }
}
