import { AggregateRoot } from '../../../../shared/kernel/entity.base';
import { RepositoryId } from './repository-id.value-object';
import { RepositoryUrl } from './repository-url.value-object';
import { FileCoverage } from './file-coverage.entity';
import { RepositoryClonedEvent } from '../events/repository-cloned.event';
import { CoverageAnalysisCompletedEvent } from '../events/coverage-analysis-completed.event';

export interface RepositoryProps {
  url: RepositoryUrl;
  localPath?: string;
  clonedAt?: Date;
  fileCoverages: FileCoverage[];
  lastAnalyzedAt?: Date;
}

export class Repository extends AggregateRoot<RepositoryId> {
  private props: RepositoryProps;

  private constructor(id: RepositoryId, props: RepositoryProps) {
    super(id);
    this.props = props;
  }

  static create(url: RepositoryUrl): Repository {
    const repositoryId = RepositoryId.generate();
    const repository = new Repository(repositoryId, {
      url,
      fileCoverages: [],
    });

    return repository;
  }

  static reconstitute(id: RepositoryId, props: RepositoryProps): Repository {
    return new Repository(id, props);
  }

  // Getters
  get url(): RepositoryUrl {
    return this.props.url;
  }

  get localPath(): string | undefined {
    return this.props.localPath;
  }

  get clonedAt(): Date | undefined {
    return this.props.clonedAt;
  }

  get fileCoverages(): FileCoverage[] {
    return [...this.props.fileCoverages];
  }

  get lastAnalyzedAt(): Date | undefined {
    return this.props.lastAnalyzedAt;
  }

  // Business logic methods
  markAsCloned(localPath: string): void {
    if (this.props.localPath) {
      throw new Error('Repository is already cloned');
    }

    this.props.localPath = localPath;
    this.props.clonedAt = new Date();

    this.apply(new RepositoryClonedEvent(this.id, this.props.url, localPath));
  }

  setCoverageResults(fileCoverages: FileCoverage[]): void {
    this.props.fileCoverages = fileCoverages;
    this.props.lastAnalyzedAt = new Date();

    const averageCoverage = this.calculateAverageCoverage();

    this.apply(
      new CoverageAnalysisCompletedEvent(
        this.id,
        fileCoverages.length,
        averageCoverage,
      ),
    );
  }

  // Helper methods
  isCloned(): boolean {
    return this.props.localPath !== undefined;
  }

  hasBeenAnalyzed(): boolean {
    return this.props.fileCoverages.length > 0;
  }

  calculateAverageCoverage(): number {
    if (this.props.fileCoverages.length === 0) {
      return 0;
    }

    const totalCoverage = this.props.fileCoverages.reduce(
      (sum, file) => sum + file.coveragePercentage,
      0,
    );

    return Math.round((totalCoverage / this.props.fileCoverages.length) * 100) / 100;
  }

  getFilesWithLowCoverage(threshold: number = 80): FileCoverage[] {
    return this.props.fileCoverages.filter((file) =>
      file.hasLowCoverage(threshold),
    );
  }

  getWorkingDirectory(entrypoint?: string): string {
    if (!this.props.localPath) {
      throw new Error('Repository has not been cloned yet');
    }

    return entrypoint
      ? `${this.props.localPath}/${entrypoint}`
      : this.props.localPath;
  }
}
