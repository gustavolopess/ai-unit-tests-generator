import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { FailJobCommand } from './fail-job.command';
import type { IJobRepository } from '../../domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '../../domain/repositories/job.repository.interface';

@CommandHandler(FailJobCommand)
export class FailJobHandler implements ICommandHandler<FailJobCommand> {
  private readonly logger = new Logger(FailJobHandler.name);

  constructor(
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
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
  }
}
