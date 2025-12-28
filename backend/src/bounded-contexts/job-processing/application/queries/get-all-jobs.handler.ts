import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetAllJobsQuery } from './get-all-jobs.query';
import { Job } from '../../domain/models/job.entity';
import type { IJobRepository } from '../../domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '../../domain/repositories/job.repository.interface';

@QueryHandler(GetAllJobsQuery)
export class GetAllJobsHandler implements IQueryHandler<GetAllJobsQuery> {
  constructor(
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
  ) {}

  async execute(query: GetAllJobsQuery): Promise<Job[]> {
    return await this.jobRepository.findAll();
  }
}
