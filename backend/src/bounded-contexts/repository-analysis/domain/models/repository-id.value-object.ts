import { ValueObject } from '../../../../shared/kernel/value-object.base';
import { randomUUID } from 'crypto';

export class RepositoryId extends ValueObject {
  private readonly value: string;

  private constructor(value: string) {
    super();
    this.value = value;
  }

  static create(value: string): RepositoryId {
    if (!value || value.trim().length === 0) {
      throw new Error('RepositoryId cannot be empty');
    }
    return new RepositoryId(value);
  }

  static generate(): RepositoryId {
    return new RepositoryId(randomUUID());
  }

  getValue(): string {
    return this.value;
  }

  protected *getAtomicValues(): Generator<unknown> {
    yield this.value;
  }
}
