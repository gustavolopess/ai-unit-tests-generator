import { ValueObject } from '@/shared/kernel/value-object.base';
import { randomUUID } from 'crypto';

export class GitRepoId extends ValueObject {
  private readonly value: string;

  private constructor(value: string) {
    super();
    this.value = value;
  }

  static create(value: string): GitRepoId {
    if (!value || value.trim().length === 0) {
      throw new Error('GitRepoId cannot be empty');
    }
    return new GitRepoId(value);
  }

  static generate(): GitRepoId {
    return new GitRepoId(randomUUID());
  }

  getValue(): string {
    return this.value;
  }

  protected *getAtomicValues(): Generator<unknown> {
    yield this.value;
  }
}
