import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { SetRepositoryPathCommand } from './set-repository-path.command';
import { JobId } from '@/bounded-contexts/job-processing/domain/models/job-id.value-object';
import type { IJobRepository } from '@/bounded-contexts/job-processing/domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '@/bounded-contexts/job-processing/domain/repositories/job.repository.interface';

@CommandHandler(SetRepositoryPathCommand)
export class SetRepositoryPathHandler implements ICommandHandler<SetRepositoryPathCommand> {
  private readonly logger = new Logger(SetRepositoryPathHandler.name);

  constructor(
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
  ) {}

  async execute(command: SetRepositoryPathCommand): Promise<void> {
    const jobId = JobId.create(command.jobId);
    const job = await this.jobRepository.findById(jobId);

    if (!job) {
      throw new NotFoundException(`Job ${command.jobId} not found`);
    }

    job.setRepositoryPath(command.repositoryPath);
    await this.jobRepository.save(job);

    this.logger.log(
      `Repository path set for job ${command.jobId}: ${command.repositoryPath}`,
    );
  }
}
