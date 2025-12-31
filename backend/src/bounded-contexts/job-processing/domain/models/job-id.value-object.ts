import { ValueObject } from '@/shared/kernel/value-object.base';
import { randomUUID } from 'crypto';

export class JobId extends ValueObject {
  private constructor(private readonly value: string) {
    super();
  }

  static create(value: string): JobId {
    if (!value || value.trim().length === 0) {
      throw new Error('JobId cannot be empty');
    }
    return new JobId(value);
  }

  static generate(): JobId {
    return new JobId(randomUUID());
  }

  getValue(): string {
    return this.value;
  }

  protected *getAtomicValues(): Generator<unknown> {
    yield this.value;
  }

  toString(): string {
    return this.value;
  }
}
