import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetChildJobsQuery } from './get-child-jobs.query';
import { Job } from '@/bounded-contexts/job-processing/domain/models/job.entity';
import type { IJobRepository } from '@/bounded-contexts/job-processing/domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '@/bounded-contexts/job-processing/domain/repositories/job.repository.interface';

@QueryHandler(GetChildJobsQuery)
export class GetChildJobsHandler implements IQueryHandler<GetChildJobsQuery> {
  constructor(
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
  ) {}

  async execute(query: GetChildJobsQuery): Promise<Job[]> {
    const jobs = await this.jobRepository.findByParentJobId(query.parentJobId);
    return jobs;
  }
}
