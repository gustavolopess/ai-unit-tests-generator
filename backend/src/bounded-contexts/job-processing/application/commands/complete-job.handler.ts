import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { CompleteJobCommand } from './complete-job.command';
import type { IJobRepository } from '@/bounded-contexts/job-processing/domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '@/bounded-contexts/job-processing/domain/repositories/job.repository.interface';
import { JobStatus } from '@/bounded-contexts/job-processing/domain/models/job-status.enum';
import { GIT_REPO_REPOSITORY } from '@/bounded-contexts/git-repo-analysis/domain/repositories/git-repo.repository.interface';
import type { IGitRepoRepository } from '@/bounded-contexts/git-repo-analysis/domain/repositories/git-repo.repository.interface';
import { GetRepositoryQuery } from '@/bounded-contexts/git-repo-analysis/application/queries';
import { GitRepo } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo.entity';

@CommandHandler(CompleteJobCommand)
export class CompleteJobHandler implements ICommandHandler<CompleteJobCommand> {
  private readonly logger = new Logger(CompleteJobHandler.name);

  constructor(
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
    @Inject(GIT_REPO_REPOSITORY)
    private readonly repositoryRepository: IGitRepoRepository,
    private readonly queryBus: QueryBus,
  ) {}

  async execute(command: CompleteJobCommand): Promise<void> {
    const { jobId } = command;

    this.logger.log(`Completing job ${jobId}`);

    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    job.updateStatus(JobStatus.COMPLETED);
    await this.jobRepository.save(job);

    this.logger.log(`Job ${jobId} completed successfully`);

    // Release the repository lock
    try {
      const repository: GitRepo = await this.queryBus.execute(
        new GetRepositoryQuery(job.repositoryId),
      );

      await this.repositoryRepository.releaseLock(repository.url, jobId);
      this.logger.log(
        `Lock released for job ${jobId} on repository ${repository.url.getValue()}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to release lock for job ${jobId}: ${error.message}`,
      );
      // Don't throw - job is already completed, just log the error
    }
  }
}
