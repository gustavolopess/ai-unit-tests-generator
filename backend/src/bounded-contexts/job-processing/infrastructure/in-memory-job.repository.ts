import { Injectable, Logger } from '@nestjs/common';
import { IJobRepository } from '../domain/repositories/job.repository.interface';
import { Job } from '../domain/models/job.entity';
import { JobId } from '../domain/models/job-id.value-object';

@Injectable()
export class InMemoryJobRepository implements IJobRepository {
  private readonly logger = new Logger(InMemoryJobRepository.name);
  private readonly jobs = new Map<string, Job>();

  async save(job: Job): Promise<void> {
    this.jobs.set(job.id.getValue(), job);
    this.logger.log(`Job saved: ${job.id.getValue()}`);
  }

  async findById(id: JobId | string): Promise<Job | null> {
    const idValue = typeof id === 'string' ? id : id.getValue();
    const job = this.jobs.get(idValue) || null;
    if (job) {
      this.logger.log(`Job found: ${idValue}`);
    } else {
      this.logger.warn(`Job not found: ${idValue}`);
    }
    return job;
  }

  async findAll(): Promise<Job[]> {
    const jobs = Array.from(this.jobs.values());
    this.logger.log(`Retrieved ${jobs.length} jobs`);
    return jobs;
  }

  async findByParentJobId(parentJobId: string): Promise<Job[]> {
    const childJobs = Array.from(this.jobs.values()).filter(
      (job) => job.parentJobId === parentJobId,
    );
    this.logger.log(`Found ${childJobs.length} child jobs for parent ${parentJobId}`);
    return childJobs;
  }

  async delete(id: JobId): Promise<void> {
    const deleted = this.jobs.delete(id.getValue());
    if (deleted) {
      this.logger.log(`Job deleted: ${id.getValue()}`);
    } else {
      this.logger.warn(`Job not found for deletion: ${id.getValue()}`);
    }
  }
}
