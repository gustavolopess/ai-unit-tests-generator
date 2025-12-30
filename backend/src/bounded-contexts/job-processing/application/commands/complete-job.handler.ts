import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { CompleteJobCommand } from './complete-job.command';
import type { IJobRepository } from '../../domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '../../domain/repositories/job.repository.interface';
import { JobStatus } from '../../domain/models/job-status.enum';

@CommandHandler(CompleteJobCommand)
export class CompleteJobHandler implements ICommandHandler<CompleteJobCommand> {
  private readonly logger = new Logger(CompleteJobHandler.name);

  constructor(
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
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
  }
}
