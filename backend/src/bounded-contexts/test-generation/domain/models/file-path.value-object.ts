import { ValueObject } from '../../../../shared/kernel/value-object.base';

export class FilePath extends ValueObject {
  private readonly value: string;

  private constructor(value: string) {
    super();
    this.value = value;
  }

  static create(path: string): FilePath {
    if (!path || path.trim().length === 0) {
      throw new Error('File path cannot be empty');
    }

    // Basic validation - should not be absolute path or contain malicious patterns
    if (path.startsWith('/') || path.includes('..')) {
      throw new Error('Invalid file path: must be relative and safe');
    }

    return new FilePath(path);
  }

  getValue(): string {
    return this.value;
  }

  protected *getAtomicValues(): Generator<unknown> {
    yield this.value;
  }
}
