import { Job } from '@/bounded-contexts/job-processing/domain/models/job.entity';
import { JobId } from '@/bounded-contexts/job-processing/domain/models/job-id.value-object';

export interface IJobRepository {
  save(job: Job): Promise<void>;
  findById(id: JobId): Promise<Job | null>;
  findById(id: string): Promise<Job | null>;
  findAll(): Promise<Job[]>;
  findByParentJobId(parentJobId: string): Promise<Job[]>;
  delete(id: JobId): Promise<void>;
}

export const JOB_REPOSITORY = Symbol('IJobRepository');
