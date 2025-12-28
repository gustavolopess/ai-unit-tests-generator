import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetJobQuery } from './get-job.query';
import { Job } from '../../domain/models/job.entity';
import { JobId } from '../../domain/models/job-id.value-object';
import type { IJobRepository } from '../../domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '../../domain/repositories/job.repository.interface';

@QueryHandler(GetJobQuery)
export class GetJobHandler implements IQueryHandler<GetJobQuery> {
  constructor(
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
  ) {}

  async execute(query: GetJobQuery): Promise<Job> {
    const { jobId } = query;

    const job = await this.jobRepository.findById(JobId.create(jobId));

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    return job;
  }
}
