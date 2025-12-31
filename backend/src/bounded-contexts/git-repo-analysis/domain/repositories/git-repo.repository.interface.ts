import { GitRepo } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo.entity';
import { GitRepoId } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo-id.value-object';
import { GitRepoUrl } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo-url.value-object';

export const GIT_REPO_REPOSITORY = Symbol('GIT_REPO_REPOSITORY');

export interface IGitRepoRepository {
  save(gitRepo: GitRepo): Promise<void>;
  findById(id: GitRepoId): Promise<GitRepo | null>;
  findByUrl(url: GitRepoUrl): Promise<GitRepo | null>;
  delete(id: GitRepoId): Promise<void>;

  // Lock methods for concurrency control
  acquireLock(url: GitRepoUrl, jobId: string): Promise<boolean>;
  releaseLock(url: GitRepoUrl, jobId: string): Promise<void>;
  isLocked(url: GitRepoUrl): Promise<boolean>;
  cleanupAllStaleLocks(): Promise<number>;
}
