import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { FailJobCommand } from './fail-job.command';
import type { IJobRepository } from '@/bounded-contexts/job-processing/domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '@/bounded-contexts/job-processing/domain/repositories/job.repository.interface';
import { GIT_REPO_REPOSITORY } from '@/bounded-contexts/git-repo-analysis/domain/repositories/git-repo.repository.interface';
import type { IGitRepoRepository } from '@/bounded-contexts/git-repo-analysis/domain/repositories/git-repo.repository.interface';
import { GetRepositoryQuery } from '@/bounded-contexts/git-repo-analysis/application/queries';
import { GitRepo } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo.entity';

@CommandHandler(FailJobCommand)
export class FailJobHandler implements ICommandHandler<FailJobCommand> {
  private readonly logger = new Logger(FailJobHandler.name);

  constructor(
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
    @Inject(GIT_REPO_REPOSITORY)
    private readonly repositoryRepository: IGitRepoRepository,
    private readonly queryBus: QueryBus,
  ) {}

  async execute(command: FailJobCommand): Promise<void> {
    const { jobId, error } = command;

    this.logger.error(`Failing job ${jobId}: ${error}`);

    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    job.setError(error);
    await this.jobRepository.save(job);

    this.logger.log(`Job ${jobId} marked as failed`);

    // Release the repository lock
    try {
      const repository: GitRepo = await this.queryBus.execute(
        new GetRepositoryQuery(job.repositoryId),
      );

      await this.repositoryRepository.releaseLock(repository.url, jobId);
      this.logger.log(
        `Lock released for job ${jobId} on repository ${repository.url.getValue()}`,
      );
    } catch (lockError) {
      this.logger.error(
        `Failed to release lock for job ${jobId}: ${lockError.message}`,
      );
      // Don't throw - job is already marked as failed, just log the error
    }
  }
}
