import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { UpdateJobStatusCommand } from './update-job-status.command';
import { JobId } from '@/bounded-contexts/job-processing/domain/models/job-id.value-object';
import type { IJobRepository } from '@/bounded-contexts/job-processing/domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '@/bounded-contexts/job-processing/domain/repositories/job.repository.interface';

@CommandHandler(UpdateJobStatusCommand)
export class UpdateJobStatusHandler implements ICommandHandler<UpdateJobStatusCommand> {
  private readonly logger = new Logger(UpdateJobStatusHandler.name);

  constructor(
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
  ) {}

  async execute(command: UpdateJobStatusCommand): Promise<void> {
    const { jobId, status } = command;

    const job = await this.jobRepository.findById(JobId.create(jobId));

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    job.updateStatus(status);

    await this.jobRepository.save(job);

    this.logger.log(`Job ${jobId} status updated to ${status}`);
  }
}
