import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { SetTestGenerationDataCommand } from './set-test-generation-data.command';
import { JobId } from '../../domain/models/job-id.value-object';
import type { IJobRepository } from '../../domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '../../domain/repositories/job.repository.interface';

@CommandHandler(SetTestGenerationDataCommand)
export class SetTestGenerationDataHandler
  implements ICommandHandler<SetTestGenerationDataCommand>
{
  private readonly logger = new Logger(SetTestGenerationDataHandler.name);

  constructor(
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
  ) {}

  async execute(command: SetTestGenerationDataCommand): Promise<void> {
    const jobId = JobId.create(command.jobId);
    const job = await this.jobRepository.findById(jobId);

    if (!job) {
      throw new NotFoundException(`Job ${command.jobId} not found`);
    }

    if (command.sessionId) {
      job.setSessionId(command.sessionId);
    }
    job.setTestGenerationRequestId(command.testGenerationRequestId);
    job.setTestGenerationResult(command.testGenerationResult);

    await this.jobRepository.save(job);

    this.logger.log(`Test generation data set for job ${command.jobId}`);
  }
}
