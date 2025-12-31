import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { IGitRepoRepository } from '@/bounded-contexts/git-repo-analysis/domain/repositories/git-repo.repository.interface';
import { GitRepo } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo.entity';
import { GitRepoId } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo-id.value-object';
import { GitRepoUrl } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo-url.value-object';
import { GitRepoEntity } from './entities/git-repo.entity';
import { FileCoverageEntity } from './entities/file-coverage.entity';
import { FileCoverage } from '@/bounded-contexts/git-repo-analysis/domain/models/file-coverage.entity';
import { randomUUID } from 'crypto';
import { AppConfig } from '@/shared/config/app.config';

@Injectable()
export class TypeOrmGitRepoRepository implements IGitRepoRepository {
  private readonly logger = new Logger(TypeOrmGitRepoRepository.name);

  constructor(
    @InjectRepository(GitRepoEntity)
    private readonly repository: TypeOrmRepository<GitRepoEntity>,
    @InjectRepository(FileCoverageEntity)
    private readonly fileCoverageRepository: TypeOrmRepository<FileCoverageEntity>,
  ) {}

  async save(repo: GitRepo): Promise<void> {
    const entity = this.toEntity(repo);

    if (!entity.id) {
      throw new Error(`Repository entity has no ID: ${JSON.stringify(entity)}`);
    }

    this.logger.debug(
      `Saving repository ${entity.id} with ${repo.fileCoverages.length} file coverages`,
    );
    this.logger.debug(
      `Entity data: ${JSON.stringify({ id: entity.id, url: entity.url, status: entity.status })}`,
    );

    // Use a transaction to ensure atomicity of repository + file coverages save
    await this.repository.manager.transaction(
      async (transactionalEntityManager) => {
        // Save repository entity
        const savedEntity = await transactionalEntityManager.save(
          GitRepoEntity,
          entity,
        );
        this.logger.debug(`Repository entity saved with ID: ${savedEntity.id}`);

        // Delete existing file coverages
        await transactionalEntityManager.delete(FileCoverageEntity, {
          repositoryId: savedEntity.id,
        });

        // Insert new file coverages
        if (repo.fileCoverages.length > 0) {
          const now = new Date().toISOString();
          this.logger.debug(
            `Inserting ${repo.fileCoverages.length} file coverage entries for repository ${savedEntity.id}`,
          );

          for (const fc of repo.fileCoverages) {
            const id = randomUUID();
            await transactionalEntityManager.query(
              `INSERT INTO file_coverages (id, repository_id, file_path, coverage_percentage, lines_covered, lines_total, created_at)
             VALUES (?, ?, ?, ?, NULL, NULL, ?)`,
              [id, savedEntity.id, fc.filePath, fc.coveragePercentage, now],
            );
          }

          this.logger.debug(
            `Successfully inserted ${repo.fileCoverages.length} file coverage entities`,
          );
        }
      },
    );

    this.logger.log(`Repository saved: ${repo.id.getValue()}`);
  }

  async findById(id: GitRepoId): Promise<GitRepo | null> {
    const entity = await this.repository.findOne({
      where: { id: id.getValue() },
      relations: ['fileCoverages'],
    });

    if (!entity) {
      this.logger.warn(`Repository not found: ${id.getValue()}`);
      return null;
    }

    this.logger.log(`Repository found: ${id.getValue()}`);
    return this.toDomain(entity);
  }

  async findByUrl(url: GitRepoUrl): Promise<GitRepo | null> {
    const entity = await this.repository.findOne({
      where: { url: url.getValue() },
      relations: ['fileCoverages'],
    });

    if (!entity) {
      this.logger.warn(`Repository not found by URL: ${url.getValue()}`);
      return null;
    }

    this.logger.log(`Repository found by URL: ${url.getValue()}`);
    return this.toDomain(entity);
  }

  async delete(id: GitRepoId): Promise<void> {
    const result = await this.repository.delete(id.getValue());
    if (result.affected && result.affected > 0) {
      this.logger.log(`Repository deleted: ${id.getValue()}`);
    } else {
      this.logger.warn(`Repository not found for deletion: ${id.getValue()}`);
    }
  }

  // Mapper methods
  private toEntity(repo: GitRepo): GitRepoEntity {
    const entity = new GitRepoEntity();
    entity.id = repo.id.getValue();
    entity.url = repo.url.getValue();
    entity.localPath = repo.localPath;
    entity.status = repo.isCloned() ? 'CLONED' : 'PENDING';
    entity.clonedAt = repo.clonedAt;
    entity.lastAnalyzedAt = repo.lastAnalyzedAt;

    // Calculate average coverage
    const coverages = repo.fileCoverages;
    if (coverages.length > 0) {
      const sum = coverages.reduce((acc, fc) => acc + fc.coveragePercentage, 0);
      entity.averageCoverage = sum / coverages.length;
    }

    entity.fileCoverages = [];
    return entity;
  }

  private toDomain(entity: GitRepoEntity): GitRepo {
    const repositoryId = GitRepoId.create(entity.id);
    const repositoryUrl = GitRepoUrl.create(entity.url);

    const fileCoverages = (entity.fileCoverages || []).map((fc) =>
      FileCoverage.reconstitute(fc.filePath, {
        filePath: fc.filePath,
        coveragePercentage: fc.coveragePercentage,
        analyzedAt: fc.createdAt,
      }),
    );

    return GitRepo.reconstitute(repositoryId, {
      url: repositoryUrl,
      localPath: entity.localPath,
      clonedAt: entity.clonedAt,
      lastAnalyzedAt: entity.lastAnalyzedAt,
      fileCoverages,
    });
  }

  /**
   * Acquire lock for repository
   * Uses atomic UPDATE with WHERE condition to ensure only one job can acquire the lock
   * Automatically detects and cleans up stale locks (older than 30 minutes)
   * Returns true if lock was acquired, false if already locked
   */
  async acquireLock(url: GitRepoUrl, jobId: string): Promise<boolean> {
    const normalizedUrl = url.getValue();

    try {
      // First, clean up any stale locks for this repository
      await this.cleanupStaleLock(normalizedUrl);

      // First, ensure repository exists
      let repository = await this.repository.findOne({
        where: { url: normalizedUrl },
      });

      if (!repository) {
        // Repository doesn't exist yet - create it with lock acquired
        repository = this.repository.create({
          id: randomUUID(),
          url: normalizedUrl,
          status: 'PENDING',
          lockAcquired: true,
          lockedAt: new Date(),
          lockedByJobId: jobId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await this.repository.save(repository);
        this.logger.log(
          `Lock acquired for new repository ${normalizedUrl} by job ${jobId}`,
        );
        return true;
      }

      // Repository exists - try to acquire lock atomically
      // This UPDATE will only succeed if lock_acquired = false
      const result = await this.repository
        .createQueryBuilder()
        .update(GitRepoEntity)
        .set({
          lockAcquired: true,
          lockedAt: new Date(),
          lockedByJobId: jobId,
          updatedAt: new Date(),
        })
        .where('url = :url', { url: normalizedUrl })
        .andWhere('lock_acquired = :lockAcquired', { lockAcquired: false })
        .execute();

      const acquired = result.affected === 1;

      if (acquired) {
        this.logger.log(
          `Lock acquired for repository ${normalizedUrl} by job ${jobId}`,
        );
      } else {
        // Check who owns the lock
        const lockedRepo = await this.repository.findOne({
          where: { url: normalizedUrl },
        });
        this.logger.warn(
          `Failed to acquire lock for repository ${normalizedUrl} by job ${jobId}. ` +
            `Currently locked by job ${lockedRepo?.lockedByJobId} since ${lockedRepo?.lockedAt}`,
        );
      }

      return acquired;
    } catch (error) {
      this.logger.error(
        `Error acquiring lock for repository ${normalizedUrl}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Release lock for repository
   * Only releases if the lock is held by the specified job
   */
  async releaseLock(url: GitRepoUrl, jobId: string): Promise<void> {
    const normalizedUrl = url.getValue();

    try {
      const result = await this.repository
        .createQueryBuilder()
        .update(GitRepoEntity)
        .set({
          lockAcquired: false,
          lockedAt: undefined,
          lockedByJobId: undefined,
          updatedAt: new Date(),
        })
        .where('url = :url', { url: normalizedUrl })
        .andWhere('locked_by_job_id = :jobId', { jobId })
        .execute();

      if (result.affected === 1) {
        this.logger.log(
          `Lock released for repository ${normalizedUrl} by job ${jobId}`,
        );
      } else {
        this.logger.warn(
          `Failed to release lock for repository ${normalizedUrl} by job ${jobId}. ` +
            `Lock may not be held by this job.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error releasing lock for repository ${normalizedUrl}: ${error.message}`,
      );
    }
  }

  /**
   * Check if repository is locked
   */
  async isLocked(url: GitRepoUrl): Promise<boolean> {
    const normalizedUrl = url.getValue();

    try {
      const repository = await this.repository.findOne({
        where: { url: normalizedUrl },
        select: ['lockAcquired'],
      });

      return repository?.lockAcquired ?? false;
    } catch (error) {
      this.logger.error(
        `Error checking lock status for repository ${normalizedUrl}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Clean up stale lock for a specific repository
   * A lock is considered stale if it's older than LOCK_TIMEOUT_MS (default: 30 minutes)
   * This prevents deadlocks from server crashes or abrupt shutdowns
   */
  private async cleanupStaleLock(url: string): Promise<void> {
    const lockTimeoutMs = AppConfig.jobs.lockTimeoutMs;

    try {
      const now = new Date();
      const staleThreshold = new Date(now.getTime() - lockTimeoutMs);

      const result = await this.repository
        .createQueryBuilder()
        .update(GitRepoEntity)
        .set({
          lockAcquired: false,
          lockedAt: undefined,
          lockedByJobId: undefined,
          updatedAt: new Date(),
        })
        .where('url = :url', { url })
        .andWhere('lock_acquired = :lockAcquired', { lockAcquired: true })
        .andWhere('locked_at < :staleThreshold', { staleThreshold })
        .execute();

      if (result.affected && result.affected > 0) {
        this.logger.warn(
          `Cleaned up stale lock for repository ${url}. Lock was older than ${lockTimeoutMs / 1000 / 60} minutes.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error cleaning up stale lock for repository ${url}: ${error.message}`,
      );
    }
  }

  /**
   * Clean up all stale locks across all repositories
   * Should be called periodically (e.g., on application startup or via cron)
   */
  async cleanupAllStaleLocks(): Promise<number> {
    const lockTimeoutMs = AppConfig.jobs.lockTimeoutMs;

    try {
      const now = new Date();
      const staleThreshold = new Date(now.getTime() - lockTimeoutMs);

      const result = await this.repository
        .createQueryBuilder()
        .update(GitRepoEntity)
        .set({
          lockAcquired: false,
          lockedAt: undefined,
          lockedByJobId: undefined,
          updatedAt: new Date(),
        })
        .where('lock_acquired = :lockAcquired', { lockAcquired: true })
        .andWhere('locked_at < :staleThreshold', { staleThreshold })
        .execute();

      const cleaned = result.affected ?? 0;

      if (cleaned > 0) {
        this.logger.warn(
          `Cleaned up ${cleaned} stale lock(s). Locks were older than ${lockTimeoutMs / 1000 / 60} minutes.`,
        );
      } else {
        this.logger.log('No stale locks found during cleanup.');
      }

      return cleaned;
    } catch (error) {
      this.logger.error(`Error cleaning up all stale locks: ${error.message}`);
      return 0;
    }
  }
}
