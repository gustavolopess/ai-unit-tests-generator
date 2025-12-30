import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IJobRepository } from '../domain/repositories/job.repository.interface';
import { Job } from '../domain/models/job.entity';
import { JobId } from '../domain/models/job-id.value-object';
import { JobEntity } from './entities/job.entity';
import { JobStatus } from '../domain/models/job-status.enum';

@Injectable()
export class TypeOrmJobRepository implements IJobRepository {
  private readonly logger = new Logger(TypeOrmJobRepository.name);

  constructor(
    @InjectRepository(JobEntity)
    private readonly repository: Repository<JobEntity>,
  ) {}

  async save(job: Job): Promise<void> {
    const entity = this.toEntity(job);
    await this.repository.save(entity);
    this.logger.log(`Job saved: ${job.id.getValue()}`);
  }

  async findById(id: JobId | string): Promise<Job | null> {
    const idValue = typeof id === 'string' ? id : id.getValue();
    const entity = await this.repository.findOne({ where: { id: idValue } });

    if (!entity) {
      this.logger.warn(`Job not found: ${idValue}`);
      return null;
    }

    this.logger.log(`Job found: ${idValue}`);
    return this.toDomain(entity);
  }

  async findAll(): Promise<Job[]> {
    const entities = await this.repository.find({
      order: { createdAt: 'DESC' },
    });
    this.logger.log(`Retrieved ${entities.length} jobs`);
    return entities.map((entity) => this.toDomain(entity));
  }

  async findByParentJobId(parentJobId: string): Promise<Job[]> {
    const entities = await this.repository.find({
      where: { parentJobId },
      order: { createdAt: 'DESC' },
    });
    this.logger.log(`Found ${entities.length} child jobs for parent ${parentJobId}`);
    return entities.map((entity) => this.toDomain(entity));
  }

  async delete(id: JobId): Promise<void> {
    const result = await this.repository.delete(id.getValue());
    if (result.affected && result.affected > 0) {
      this.logger.log(`Job deleted: ${id.getValue()}`);
    } else {
      this.logger.warn(`Job not found for deletion: ${id.getValue()}`);
    }
  }

  // Mapper methods
  private toEntity(job: Job): JobEntity {
    const entity = new JobEntity();
    entity.id = job.id.getValue();
    entity.parentJobId = job.parentJobId;
    entity.repositoryId = job.repositoryId;
    entity.targetFilePath = job.targetFilePath;
    entity.entrypoint = job.entrypoint;
    entity.status = job.status;
    entity.createdAt = job.createdAt;
    entity.updatedAt = job.updatedAt;
    entity.startedAt = job.startedAt;
    entity.completedAt = job.completedAt;
    entity.logPath = job.logPath;
    entity.error = job.error;
    entity.repositoryPath = job.repositoryPath;
    entity.sessionId = job.sessionId;
    entity.testGenerationRequestId = job.testGenerationRequestId;
    entity.coverageResult = job.coverageResult;
    entity.testGenerationResult = job.testGenerationResult;
    entity.prCreationResult = job.prCreationResult;
    return entity;
  }

  private toDomain(entity: JobEntity): Job {
    const jobId = JobId.create(entity.id);
    return Job.reconstitute(jobId, {
      repositoryId: entity.repositoryId,
      targetFilePath: entity.targetFilePath,
      entrypoint: entity.entrypoint,
      parentJobId: entity.parentJobId,
      status: entity.status as JobStatus,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      startedAt: entity.startedAt,
      completedAt: entity.completedAt,
      logPath: entity.logPath,
      error: entity.error,
      repositoryPath: entity.repositoryPath,
      sessionId: entity.sessionId,
      testGenerationRequestId: entity.testGenerationRequestId,
      coverageResult: entity.coverageResult,
      testGenerationResult: entity.testGenerationResult,
      prCreationResult: entity.prCreationResult,
    });
  }
}
