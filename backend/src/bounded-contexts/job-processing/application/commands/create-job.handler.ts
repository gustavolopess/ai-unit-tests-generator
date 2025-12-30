import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { CreateJobCommand } from './create-job.command';
import { Job } from '../../domain/models/job.entity';
import type { IJobRepository } from '../../domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '../../domain/repositories/job.repository.interface';

@CommandHandler(CreateJobCommand)
export class CreateJobHandler implements ICommandHandler<CreateJobCommand> {
  private readonly logger = new Logger(CreateJobHandler.name);

  constructor(
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
  ) {}

  async execute(command: CreateJobCommand): Promise<Job> {
    const { repositoryId, targetFilePath, parentJobId, entrypoint } = command;

    const job = Job.create(repositoryId, targetFilePath, parentJobId, entrypoint);

    // If this is a child job, inherit parent's analysis results
    if (parentJobId) {
      const parentJob = await this.jobRepository.findById(parentJobId);
      if (!parentJob) {
        throw new Error(`Parent job ${parentJobId} not found`);
      }
      job.inheritFromParent(parentJob);
    }

    await this.jobRepository.save(job);

    this.logger.log(
      `Job created: ${job.id.getValue()} for repository ${repositoryId}${parentJobId ? ` (child of ${parentJobId})` : ''}${targetFilePath ? ` targeting file ${targetFilePath}` : ''}`,
    );

    return job;
  }
}
