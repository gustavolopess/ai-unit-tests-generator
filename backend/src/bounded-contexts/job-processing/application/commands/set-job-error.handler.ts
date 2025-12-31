import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { SetJobErrorCommand } from './set-job-error.command';
import { JobId } from '@/bounded-contexts/job-processing/domain/models/job-id.value-object';
import type { IJobRepository } from '@/bounded-contexts/job-processing/domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '@/bounded-contexts/job-processing/domain/repositories/job.repository.interface';

@CommandHandler(SetJobErrorCommand)
export class SetJobErrorHandler implements ICommandHandler<SetJobErrorCommand> {
  private readonly logger = new Logger(SetJobErrorHandler.name);

  constructor(
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
  ) {}

  async execute(command: SetJobErrorCommand): Promise<void> {
    const { jobId, error } = command;

    const job = await this.jobRepository.findById(JobId.create(jobId));

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    job.setError(error);

    await this.jobRepository.save(job);

    this.logger.error(`Job ${jobId} failed: ${error}`);
  }
}
