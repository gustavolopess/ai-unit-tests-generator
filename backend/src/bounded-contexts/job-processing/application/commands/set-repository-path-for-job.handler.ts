import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { SetRepositoryPathForJobCommand } from './set-repository-path-for-job.command';
import type { IJobRepository } from '@/bounded-contexts/job-processing/domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '@/bounded-contexts/job-processing/domain/repositories/job.repository.interface';
import { GIT_REPO_REPOSITORY } from '@/bounded-contexts/git-repo-analysis/domain/repositories/git-repo.repository.interface';
import type { IGitRepoRepository } from '@/bounded-contexts/git-repo-analysis/domain/repositories/git-repo.repository.interface';
import { GetRepositoryQuery } from '@/bounded-contexts/git-repo-analysis/application/queries';
import { QueryBus } from '@nestjs/cqrs';
import { GitRepo } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo.entity';
import { RepositoryPathSetEvent } from '@/bounded-contexts/job-processing/domain/events/repository-path-set.event';
import { GitRepoUrl } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo-url.value-object';

@CommandHandler(SetRepositoryPathForJobCommand)
export class SetRepositoryPathForJobHandler implements ICommandHandler<SetRepositoryPathForJobCommand> {
  private readonly logger = new Logger(SetRepositoryPathForJobHandler.name);

  constructor(
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
    @Inject(GIT_REPO_REPOSITORY)
    private readonly repositoryRepository: IGitRepoRepository,
    private readonly queryBus: QueryBus,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: SetRepositoryPathForJobCommand): Promise<void> {
    const { jobId } = command;

    this.logger.log(`Setting repository path for job ${jobId}`);

    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Get repository to fetch its local path
    const repository: GitRepo = await this.queryBus.execute(
      new GetRepositoryQuery(job.repositoryId),
    );

    if (!repository.localPath) {
      throw new Error(`Repository ${job.repositoryId} has not been cloned yet`);
    }

    // Try to acquire lock on the repository - retry with exponential backoff
    const maxRetries = 30; // 30 attempts
    const baseDelayMs = 1000; // Start with 1 second
    let lockAcquired = false;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      lockAcquired = await this.repositoryRepository.acquireLock(
        repository.url,
        jobId,
      );

      if (lockAcquired) {
        this.logger.log(
          `Lock acquired for job ${jobId} on repository ${repository.url.getValue()}`,
        );
        break;
      }

      // Lock not acquired, wait and retry with exponential backoff
      const delay = Math.min(baseDelayMs * Math.pow(1.5, attempt), 30000); // Max 30 seconds
      this.logger.log(
        `Lock not acquired for job ${jobId}, attempt ${attempt + 1}/${maxRetries}. Retrying in ${delay}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (!lockAcquired) {
      throw new Error(
        `Failed to acquire lock on repository ${repository.url.getValue()} for job ${jobId} after ${maxRetries} attempts`,
      );
    }

    // Set the repository path on the job
    job.setRepositoryPath(repository.localPath);
    await this.jobRepository.save(job);

    this.logger.log(
      `Repository path set for job ${jobId}: ${repository.localPath}`,
    );

    // Publish event to trigger next step
    this.eventBus.publish(new RepositoryPathSetEvent(jobId));
  }
}
