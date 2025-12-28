import { ValueObject } from '../../../../shared/kernel/value-object.base';

export class RepositoryUrl extends ValueObject {
  private readonly value: string;

  private constructor(value: string) {
    super();
    this.value = value;
  }

  static create(url: string): RepositoryUrl {
    if (!url || url.trim().length === 0) {
      throw new Error('Repository URL cannot be empty');
    }

    // Basic GitHub URL validation
    const githubPattern = /^https?:\/\/(www\.)?github\.com\/.+\/.+(\.git)?$/;
    if (!githubPattern.test(url)) {
      throw new Error('Invalid GitHub repository URL');
    }

    return new RepositoryUrl(url);
  }

  getValue(): string {
    return this.value;
  }

  /**
   * Normalizes the URL for comparison and caching
   * Removes .git suffix, trailing slashes, and converts to lowercase
   */
  getNormalized(): string {
    return this.value
      .replace(/\.git$/, '')
      .replace(/\/$/, '')
      .toLowerCase();
  }

  protected *getAtomicValues(): Generator<unknown> {
    yield this.value;
  }
}
