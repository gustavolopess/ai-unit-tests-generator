import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { AppendJobOutputCommand } from './append-job-output.command';
import { JobId } from '../../domain/models/job-id.value-object';
import type { IJobRepository } from '../../domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '../../domain/repositories/job.repository.interface';

@CommandHandler(AppendJobOutputCommand)
export class AppendJobOutputHandler
  implements ICommandHandler<AppendJobOutputCommand>
{
  constructor(
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
  ) {}

  async execute(command: AppendJobOutputCommand): Promise<void> {
    const { jobId, output } = command;

    const job = await this.jobRepository.findById(JobId.create(jobId));

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    job.appendOutput(output);

    await this.jobRepository.save(job);
  }
}
