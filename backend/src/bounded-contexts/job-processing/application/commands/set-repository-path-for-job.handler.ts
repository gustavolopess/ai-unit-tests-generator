import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { SetRepositoryPathForJobCommand } from './set-repository-path-for-job.command';
import type { IJobRepository } from '../../domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '../../domain/repositories/job.repository.interface';
import { GetRepositoryQuery } from '../../../repository-analysis/application/queries';
import { QueryBus } from '@nestjs/cqrs';
import { Repository } from '../../../repository-analysis/domain/models/repository.entity';
import { RepositoryPathSetEvent } from '../../domain/events/repository-path-set.event';

@CommandHandler(SetRepositoryPathForJobCommand)
export class SetRepositoryPathForJobHandler
  implements ICommandHandler<SetRepositoryPathForJobCommand>
{
  private readonly logger = new Logger(SetRepositoryPathForJobHandler.name);

  constructor(
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
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
    const repository: Repository = await this.queryBus.execute(
      new GetRepositoryQuery(job.repositoryId),
    );

    if (!repository.localPath) {
      throw new Error(`Repository ${job.repositoryId} has not been cloned yet`);
    }

    // Set the repository path on the job
    job.setRepositoryPath(repository.localPath);
    await this.jobRepository.save(job);

    this.logger.log(`Repository path set for job ${jobId}: ${repository.localPath}`);

    // Publish event to trigger next step
    this.eventBus.publish(new RepositoryPathSetEvent(jobId));
  }
}
