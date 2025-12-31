import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { GIT_REPO_REPOSITORY } from '@/bounded-contexts/git-repo-analysis/domain/repositories/git-repo.repository.interface';
import type { IGitRepoRepository } from '@/bounded-contexts/git-repo-analysis/domain/repositories/git-repo.repository.interface';

/**
 * Service that automatically cleans up stale repository locks on application startup
 * This prevents deadlocks from server crashes or abrupt shutdowns
 */
@Injectable()
export class LockCleanupService implements OnModuleInit {
  private readonly logger = new Logger(LockCleanupService.name);

  constructor(
    @Inject(GIT_REPO_REPOSITORY)
    private readonly gitRepoRepository: IGitRepoRepository,
  ) {}

  /**
   * Called when the module is initialized
   * Cleans up any stale locks from previous sessions
   */
  async onModuleInit() {
    this.logger.log('Checking for stale repository locks on startup...');

    try {
      const cleaned = await this.gitRepoRepository.cleanupAllStaleLocks();

      if (cleaned > 0) {
        this.logger.warn(
          `Cleaned up ${cleaned} stale lock(s) from previous sessions.`,
        );
      } else {
        this.logger.log('No stale locks found. All clear!');
      }
    } catch (error) {
      this.logger.error(
        `Failed to clean up stale locks on startup: ${error.message}`,
      );
    }
  }
}
