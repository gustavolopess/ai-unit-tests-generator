import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { InstallDependenciesCommand } from './install-dependencies.command';
import { DependenciesInstalledEvent } from '@/bounded-contexts/job-processing/domain/events';
import type { IJobRepository } from '@/bounded-contexts/job-processing/domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '@/bounded-contexts/job-processing/domain/repositories/job.repository.interface';
import type { INpmService } from '@/bounded-contexts/job-processing/domain/services/npm-service.interface';
import { NPM_SERVICE } from '@/bounded-contexts/job-processing/domain/services/npm-service.interface';
import { JobStatus } from '@/bounded-contexts/job-processing/domain/models/job-status.enum';

@CommandHandler(InstallDependenciesCommand)
export class InstallDependenciesHandler implements ICommandHandler<InstallDependenciesCommand> {
  private readonly logger = new Logger(InstallDependenciesHandler.name);

  constructor(
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
    @Inject(NPM_SERVICE)
    private readonly npmService: INpmService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: InstallDependenciesCommand): Promise<void> {
    const { jobId } = command;

    this.logger.log(`Installing dependencies for job ${jobId}`);

    try {
      // Get job
      const job = await this.jobRepository.findById(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      if (!job.repositoryPath) {
        throw new Error(`Job ${jobId} has no repository path`);
      }

      // Update status
      job.updateStatus(JobStatus.INSTALLING);
      await this.jobRepository.save(job);

      // Log
      await this.appendLog(jobId, 'Running npm install...');

      // Determine working directory based on entrypoint
      // Validate entrypoint to prevent path traversal
      if (job.entrypoint) {
        this.validateEntrypoint(job.entrypoint);
      }

      const workDir = job.entrypoint
        ? `${job.repositoryPath}/${job.entrypoint}`
        : job.repositoryPath;

      if (job.entrypoint) {
        await this.appendLog(
          jobId,
          `Using entrypoint directory: ${job.entrypoint}`,
        );
      }

      // Sanitize working directory path
      this.validateDirectoryPath(workDir);

      // Run npm install via the npm service
      await this.npmService.install(workDir, 300000);

      await this.appendLog(jobId, 'npm install completed');

      this.logger.log(`Dependencies installed for job ${jobId}`);

      // Publish event
      this.eventBus.publish(
        new DependenciesInstalledEvent(jobId, job.repositoryPath),
      );
    } catch (error) {
      this.logger.error(
        `Failed to install dependencies for job ${jobId}: ${error.message}`,
      );
      await this.appendLog(
        jobId,
        `ERROR: Failed to install dependencies: ${error.message}`,
      );
      throw error;
    }
  }

  private async appendLog(jobId: string, message: string): Promise<void> {
    // This is a workaround - ideally we'd inject CommandBus but that creates circular dependency
    // For now, we'll handle logging separately
    this.logger.log(`[Job ${jobId}] ${message}`);
  }

  /**
   * Validates entrypoint path to prevent path traversal attacks
   */
  private validateEntrypoint(entrypoint: string): void {
    const trimmed = entrypoint.trim();

    if (!trimmed) {
      throw new Error('Entrypoint cannot be empty');
    }

    // Check for path traversal attempts
    if (trimmed.includes('..')) {
      throw new Error(
        'Entrypoint cannot contain ".." (path traversal attempt)',
      );
    }

    // Check for absolute paths
    if (trimmed.startsWith('/') || /^[a-zA-Z]:/.test(trimmed)) {
      throw new Error('Entrypoint must be a relative path');
    }

    // Check for dangerous characters
    const dangerousChars = /[`$();|&<>]/;
    if (dangerousChars.test(trimmed)) {
      throw new Error('Entrypoint contains invalid characters');
    }
  }

  /**
   * Validates directory path to prevent command injection
   */
  private validateDirectoryPath(dirPath: string): void {
    const trimmed = dirPath.trim();

    if (!trimmed) {
      throw new Error('Directory path cannot be empty');
    }

    // Check for dangerous characters that could enable command injection
    const dangerousChars = /[`$();|&<>]/;
    if (dangerousChars.test(trimmed)) {
      throw new Error('Directory path contains invalid characters');
    }
  }
}
