import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { SetPRResultCommand } from './set-pr-result.command';
import { JobId } from '../../domain/models/job-id.value-object';
import type { IJobRepository } from '../../domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '../../domain/repositories/job.repository.interface';

@CommandHandler(SetPRResultCommand)
export class SetPRResultHandler
  implements ICommandHandler<SetPRResultCommand>
{
  private readonly logger = new Logger(SetPRResultHandler.name);

  constructor(
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
  ) {}

  async execute(command: SetPRResultCommand): Promise<void> {
    const jobId = JobId.create(command.jobId);
    const job = await this.jobRepository.findById(jobId);

    if (!job) {
      throw new NotFoundException(`Job ${command.jobId} not found`);
    }

    job.setPRCreationResult(command.prResult);
    await this.jobRepository.save(job);

    this.logger.log(`PR result set for job ${command.jobId}: ${command.prResult.prUrl}`);
  }
}
