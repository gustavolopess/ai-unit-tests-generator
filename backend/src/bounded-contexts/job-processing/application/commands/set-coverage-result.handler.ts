import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { SetCoverageResultCommand } from './set-coverage-result.command';
import { JobId } from '@/bounded-contexts/job-processing/domain/models/job-id.value-object';
import type { IJobRepository } from '@/bounded-contexts/job-processing/domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '@/bounded-contexts/job-processing/domain/repositories/job.repository.interface';

@CommandHandler(SetCoverageResultCommand)
export class SetCoverageResultHandler implements ICommandHandler<SetCoverageResultCommand> {
  private readonly logger = new Logger(SetCoverageResultHandler.name);

  constructor(
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
  ) {}

  async execute(command: SetCoverageResultCommand): Promise<void> {
    const jobId = JobId.create(command.jobId);
    const job = await this.jobRepository.findById(jobId);

    if (!job) {
      throw new NotFoundException(`Job ${command.jobId} not found`);
    }

    job.setCoverageResult(command.coverageResult);
    await this.jobRepository.save(job);

    this.logger.log(`Coverage result set for job ${command.jobId}`);
  }
}
