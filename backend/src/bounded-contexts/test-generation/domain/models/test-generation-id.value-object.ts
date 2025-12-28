import { ValueObject } from '../../../../shared/kernel/value-object.base';
import { randomUUID } from 'crypto';

export class TestGenerationId extends ValueObject {
  private readonly value: string;

  private constructor(value: string) {
    super();
    this.value = value;
  }

  static create(value: string): TestGenerationId {
    if (!value || value.trim().length === 0) {
      throw new Error('TestGenerationId cannot be empty');
    }
    return new TestGenerationId(value);
  }

  static generate(): TestGenerationId {
    return new TestGenerationId(randomUUID());
  }

  getValue(): string {
    return this.value;
  }

  protected *getAtomicValues(): Generator<unknown> {
    yield this.value;
  }
}
