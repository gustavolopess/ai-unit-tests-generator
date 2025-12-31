import { IDomainEvent } from '@/shared/kernel/domain-event.interface';
import { TestGenerationId } from '@/bounded-contexts/test-generation/domain/models/test-generation-id.value-object';

export class TestsGeneratedEvent implements IDomainEvent {
  readonly eventName = 'tests.generated';
  readonly occurredOn: Date;

  constructor(
    public readonly testGenerationId: TestGenerationId,
    public readonly repositoryId: string,
    public readonly targetFilePath: string,
    public readonly sessionId: string,
    public readonly testFilePath?: string,
    public readonly coverage?: number,
  ) {
    this.occurredOn = new Date();
  }
}
