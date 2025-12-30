import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Job, JobStatus, JobType } from './job.entity';
import { randomUUID } from 'crypto';
import { FileCoverageDto } from '../bounded-contexts/job-processing/application/dto/job-response.dto';

@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);
  private readonly jobs = new Map<string, Job>();

  createJob(repositoryUrl: string, entrypoint?: string): Job {
    const job: Job = {
      id: randomUUID(),
      type: JobType.COVERAGE_ANALYSIS,
      repositoryUrl,
      entrypoint,
      status: JobStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      output: [],
    };

    this.jobs.set(job.id, job);
    this.logger.log(
      `Created job ${job.id} for repository ${repositoryUrl}${entrypoint ? ` with entrypoint ${entrypoint}` : ''}`,
    );

    return job;
  }

  createTestGenerationJob(parentJobId: string, filePath: string): Job {
    const parentJob = this.getJob(parentJobId);

    if (!parentJob.repositoryPath) {
      throw new Error(
        'Parent job repository not available. Job may have been cleaned up or failed.',
      );
    }

    if (parentJob.status !== JobStatus.COMPLETED) {
      throw new Error(
        `Cannot create test generation job. Parent job status is ${parentJob.status}, must be COMPLETED.`,
      );
    }

    const job: Job = {
      id: randomUUID(),
      type: JobType.TEST_GENERATION,
      repositoryUrl: parentJob.repositoryUrl,
      repositoryPath: parentJob.repositoryPath,
      entrypoint: parentJob.entrypoint, // Inherit entrypoint from parent
      parentJobId,
      targetFilePath: filePath,
      status: JobStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      output: [],
    };

    this.jobs.set(job.id, job);
    this.logger.log(
      `Created test generation job ${job.id} for file ${filePath} (parent: ${parentJobId})`,
    );

    return job;
  }

  setTestGenerationResult(
    jobId: string,
    result: {
      filePath: string;
      summary: string;
      testFilePath?: string;
      coverage?: number;
    },
  ): void {
    const job = this.getJob(jobId);
    job.testGenerationResult = result;
    job.updatedAt = new Date();
    this.logger.log(
      `Job ${jobId} test generation result set for ${result.filePath}`,
    );
  }

  setSessionId(jobId: string, sessionId: string): void {
    const job = this.getJob(jobId);
    job.sessionId = sessionId;
    job.updatedAt = new Date();
    this.logger.log(`Job ${jobId} session ID set to ${sessionId}`);
  }

  setPRCreationResult(
    jobId: string,
    result: {
      prUrl: string;
      prNumber: number;
      summary: string;
    },
  ): void {
    const job = this.getJob(jobId);
    job.prCreationResult = result;
    job.updatedAt = new Date();
    this.logger.log(`Job ${jobId} PR creation result set: ${result.prUrl}`);
  }

  createPRCreationJob(testGenerationJobId: string): Job {
    const testGenJob = this.getJob(testGenerationJobId);

    if (!testGenJob.sessionId) {
      throw new Error(
        'Test generation job does not have a session ID. Cannot create PR.',
      );
    }

    if (testGenJob.status !== JobStatus.TEST_GENERATION_COMPLETED) {
      throw new Error(
        `Cannot create PR creation job. Test generation job status is ${testGenJob.status}, must be TEST_GENERATION_COMPLETED.`,
      );
    }

    const job: Job = {
      id: randomUUID(),
      type: JobType.PR_CREATION,
      repositoryUrl: testGenJob.repositoryUrl,
      repositoryPath: testGenJob.repositoryPath,
      entrypoint: testGenJob.entrypoint,
      sessionId: testGenJob.sessionId, // Reuse session from test generation
      parentJobId: testGenerationJobId,
      status: JobStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      output: [],
    };

    this.jobs.set(job.id, job);
    this.logger.log(
      `Created PR creation job ${job.id} (test gen job: ${testGenerationJobId}, session: ${job.sessionId})`,
    );

    return job;
  }

  getJob(jobId: string): Job {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }
    return job;
  }

  updateJobStatus(jobId: string, status: JobStatus): void {
    const job = this.getJob(jobId);
    job.status = status;
    job.updatedAt = new Date();

    if (status === JobStatus.CLONING && !job.startedAt) {
      job.startedAt = new Date();
    }

    if (status === JobStatus.COMPLETED || status === JobStatus.FAILED) {
      job.completedAt = new Date();
    }

    this.logger.log(`Job ${jobId} status updated to ${status}`);
  }

  setJobResult(
    jobId: string,
    result: {
      totalFiles: number;
      averageCoverage: number;
      files: FileCoverageDto[];
    },
  ): void {
    const job = this.getJob(jobId);
    job.result = result;
    job.updatedAt = new Date();
    this.logger.log(`Job ${jobId} result set with ${result.totalFiles} files`);
  }

  setJobError(jobId: string, error: string): void {
    const job = this.getJob(jobId);
    job.error = error;
    job.status = JobStatus.FAILED;
    job.completedAt = new Date();
    job.updatedAt = new Date();
    this.logger.error(`Job ${jobId} failed: ${error}`);
  }

  getAllJobs(): Job[] {
    return Array.from(this.jobs.values());
  }

  appendOutput(jobId: string, output: string): void {
    const job = this.getJob(jobId);
    job.output.push(output);
    job.updatedAt = new Date();
  }

  setRepositoryPath(jobId: string, repositoryPath: string): void {
    const job = this.getJob(jobId);
    job.repositoryPath = repositoryPath;
    job.updatedAt = new Date();
    this.logger.log(`Job ${jobId} repository path set to ${repositoryPath}`);
  }

  deleteJob(jobId: string): void {
    const job = this.getJob(jobId);
    this.jobs.delete(jobId);
    this.logger.log(`Deleted job ${jobId}`);
  }
}
