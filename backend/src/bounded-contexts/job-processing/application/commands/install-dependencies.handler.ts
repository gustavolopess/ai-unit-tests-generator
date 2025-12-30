import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { InstallDependenciesCommand } from './install-dependencies.command';
import { DependenciesInstalledEvent } from '../../domain/events';
import type { IJobRepository } from '../../domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '../../domain/repositories/job.repository.interface';
import { JobStatus } from '../../domain/models/job-status.enum';
import { UpdateJobStatusCommand, AppendJobLogCommand } from './';

const execAsync = promisify(exec);

@CommandHandler(InstallDependenciesCommand)
export class InstallDependenciesHandler
  implements ICommandHandler<InstallDependenciesCommand>
{
  private readonly logger = new Logger(InstallDependenciesHandler.name);

  constructor(
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
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
      const workDir = job.entrypoint
        ? `${job.repositoryPath}/${job.entrypoint}`
        : job.repositoryPath;

      if (job.entrypoint) {
        await this.appendLog(jobId, `Using entrypoint directory: ${job.entrypoint}`);
      }

      // Run npm install
      const { stdout, stderr } = await execAsync('npm install', {
        cwd: workDir,
        timeout: 300000, // 5 minutes timeout
      });

      if (stdout) {
        this.logger.log(`npm install stdout: ${stdout}`);
      }
      if (stderr) {
        this.logger.warn(`npm install stderr: ${stderr}`);
      }

      await this.appendLog(jobId, 'npm install completed');

      this.logger.log(`Dependencies installed for job ${jobId}`);

      // Publish event
      this.eventBus.publish(new DependenciesInstalledEvent(jobId, job.repositoryPath));
    } catch (error) {
      this.logger.error(`Failed to install dependencies for job ${jobId}: ${error.message}`);
      await this.appendLog(jobId, `ERROR: Failed to install dependencies: ${error.message}`);
      throw error;
    }
  }

  private async appendLog(jobId: string, message: string): Promise<void> {
    // This is a workaround - ideally we'd inject CommandBus but that creates circular dependency
    // For now, we'll handle logging separately
    this.logger.log(`[Job ${jobId}] ${message}`);
  }
}
