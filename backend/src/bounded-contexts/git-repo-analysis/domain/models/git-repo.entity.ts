import { AggregateRoot } from '@/shared/kernel/entity.base';
import { GitRepoId } from './git-repo-id.value-object';
import { GitRepoUrl } from './git-repo-url.value-object';
import { FileCoverage } from './file-coverage.entity';
import { GitRepoClonedEvent } from '@/bounded-contexts/git-repo-analysis/domain/events/git-repo-cloned.event';
import { CoverageAnalysisCompletedEvent } from '@/bounded-contexts/git-repo-analysis/domain/events/coverage-analysis-completed.event';

export interface GitRepoProps {
  url: GitRepoUrl;
  localPath?: string;
  clonedAt?: Date;
  fileCoverages: FileCoverage[];
  lastAnalyzedAt?: Date;
}

export class GitRepo extends AggregateRoot<GitRepoId> {
  private props: GitRepoProps;

  private constructor(id: GitRepoId, props: GitRepoProps) {
    super(id);
    this.props = props;
  }

  static create(url: GitRepoUrl): GitRepo {
    const gitRepoId = GitRepoId.generate();
    const gitRepo = new GitRepo(gitRepoId, {
      url,
      fileCoverages: [],
    });

    return gitRepo;
  }

  static reconstitute(id: GitRepoId, props: GitRepoProps): GitRepo {
    return new GitRepo(id, props);
  }

  // Getters
  get url(): GitRepoUrl {
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
      throw new Error('GitRepo is already cloned');
    }

    this.props.localPath = localPath;
    this.props.clonedAt = new Date();

    this.apply(new GitRepoClonedEvent(this.id, this.props.url, localPath));
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

    return (
      Math.round((totalCoverage / this.props.fileCoverages.length) * 100) / 100
    );
  }

  getFilesWithLowCoverage(threshold: number = 80): FileCoverage[] {
    return this.props.fileCoverages.filter((file) =>
      file.hasLowCoverage(threshold),
    );
  }

  getWorkingDirectory(entrypoint?: string): string {
    if (!this.props.localPath) {
      throw new Error('GitRepo has not been cloned yet');
    }

    return entrypoint
      ? `${this.props.localPath}/${entrypoint}`
      : this.props.localPath;
  }
}
