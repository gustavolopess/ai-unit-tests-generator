import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { GitService } from '../git/git.service';
import { ClaudeService } from '../claude/claude.service';
import { JobService } from '../job/job.service';
import { JobStatus } from '../job/job.entity';
import { FileCoverageDto } from './dto/coverage-response.dto';

const execAsync = promisify(exec);

@Injectable()
export class CoverageService {
  private readonly logger = new Logger(CoverageService.name);

  constructor(
    private readonly gitService: GitService,
    private readonly claudeService: ClaudeService,
    private readonly jobService: JobService,
  ) {}

  async processJobAsync(jobId: string): Promise<void> {
    const job = this.jobService.getJob(jobId);
    let repoPath: string | null = null;

    try {
      this.jobService.updateJobStatus(jobId, JobStatus.CLONING);
      this.jobService.appendOutput(jobId, `Cloning repository ${job.repositoryUrl}...`);

      repoPath = await this.gitService.cloneRepository(job.repositoryUrl);
      this.jobService.appendOutput(jobId, `Repository cloned to ${repoPath}`);
      this.jobService.setRepositoryPath(jobId, repoPath);

      // Determine working directory based on entrypoint
      const workDir = job.entrypoint
        ? `${repoPath}/${job.entrypoint}`
        : repoPath;

      if (job.entrypoint) {
        this.jobService.appendOutput(
          jobId,
          `Using entrypoint directory: ${job.entrypoint}`,
        );
      }

      this.jobService.updateJobStatus(jobId, JobStatus.INSTALLING);
      this.jobService.appendOutput(jobId, 'Running npm install...');
      await this.runNpmInstall(workDir);
      this.jobService.appendOutput(jobId, 'npm install completed');

      this.jobService.updateJobStatus(jobId, JobStatus.ANALYZING);
      this.jobService.appendOutput(jobId, 'Starting Claude analysis...');

      const fileCoverages = await this.claudeService.analyzeCoverage(
        workDir,
        (output: string) => {
          this.jobService.appendOutput(jobId, output);
        },
      );

      this.jobService.appendOutput(jobId, 'Analysis completed, processing results...');
      const result = this.buildResult(fileCoverages);
      this.jobService.setJobResult(jobId, result);
      this.jobService.updateJobStatus(jobId, JobStatus.COMPLETED);
      this.jobService.appendOutput(jobId, 'Job completed. Repository kept for test generation. Use cleanup endpoint when done.');

      this.logger.log(`Job ${jobId} completed successfully`);
    } catch (error) {
      this.logger.error(`Job ${jobId} failed: ${error.message}`);
      this.jobService.appendOutput(jobId, `ERROR: ${error.message}`);
      this.jobService.setJobError(jobId, error.message);

      // Cleanup on failure
      if (repoPath) {
        this.jobService.appendOutput(jobId, 'Cleaning up temporary files after failure...');
        await this.gitService.cleanup(repoPath);
        this.jobService.appendOutput(jobId, 'Cleanup completed');
      }
    }
  }

  private async runNpmInstall(repoPath: string): Promise<void> {
    try {
      this.logger.log(`Running npm install in ${repoPath}`);
      const { stdout, stderr } = await execAsync('npm install', {
        cwd: repoPath,
        timeout: 300000, // 5 minutes timeout
      });

      if (stdout) {
        this.logger.log(`npm install stdout: ${stdout}`);
      }
      if (stderr) {
        this.logger.warn(`npm install stderr: ${stderr}`);
      }

      this.logger.log('npm install completed successfully');
    } catch (error) {
      this.logger.error(`npm install failed: ${error.message}`);
      throw new Error(`Failed to install dependencies: ${error.message}`);
    }
  }

  async processTestGenerationJobAsync(testJobId: string): Promise<void> {
    const testJob = this.jobService.getJob(testJobId);

    try {
      this.jobService.updateJobStatus(testJobId, JobStatus.GENERATING_TESTS);
      this.jobService.appendOutput(
        testJobId,
        `Starting test generation for ${testJob.targetFilePath}...`,
      );

      // Determine working directory based on entrypoint
      const workDir = testJob.entrypoint
        ? `${testJob.repositoryPath}/${testJob.entrypoint}`
        : testJob.repositoryPath!;

      if (testJob.entrypoint) {
        this.jobService.appendOutput(
          testJobId,
          `Using entrypoint directory: ${testJob.entrypoint}`,
        );
      }

      const result = await this.claudeService.generateTests(
        workDir,
        testJob.targetFilePath!,
        (output: string) => {
          this.jobService.appendOutput(testJobId, output);
        },
      );

      // Store session ID if available
      if (result.sessionId) {
        this.jobService.setSessionId(testJobId, result.sessionId);
        this.jobService.appendOutput(
          testJobId,
          `Session ID saved: ${result.sessionId}`,
        );
      }

      this.jobService.appendOutput(
        testJobId,
        'Test generation completed successfully',
      );
      this.jobService.setTestGenerationResult(testJobId, {
        filePath: testJob.targetFilePath!,
        summary: result.summary,
        testFilePath: result.testFilePath,
        coverage: result.coverage,
      });
      this.jobService.updateJobStatus(
        testJobId,
        JobStatus.TEST_GENERATION_COMPLETED,
      );

      this.logger.log(`Test generation job ${testJobId} completed successfully`);
    } catch (error) {
      this.logger.error(`Test generation job ${testJobId} failed: ${error.message}`);
      this.jobService.appendOutput(testJobId, `ERROR: ${error.message}`);
      this.jobService.setJobError(testJobId, error.message);
      this.jobService.updateJobStatus(
        testJobId,
        JobStatus.TEST_GENERATION_FAILED,
      );
    }
  }

  async processPRCreationJobAsync(prJobId: string): Promise<void> {
    const prJob = this.jobService.getJob(prJobId);

    try {
      this.jobService.updateJobStatus(prJobId, JobStatus.CREATING_PR);
      this.jobService.appendOutput(
        prJobId,
        `Creating pull request using session ${prJob.sessionId}...`,
      );

      // Determine working directory based on entrypoint
      const workDir = prJob.entrypoint
        ? `${prJob.repositoryPath}/${prJob.entrypoint}`
        : prJob.repositoryPath!;

      if (prJob.entrypoint) {
        this.jobService.appendOutput(
          prJobId,
          `Using entrypoint directory: ${prJob.entrypoint}`,
        );
      }

      const result = await this.claudeService.createPullRequest(
        workDir,
        prJob.sessionId!,
        (output: string) => {
          this.jobService.appendOutput(prJobId, output);
        },
      );

      this.jobService.appendOutput(
        prJobId,
        `Pull request created successfully: ${result.prUrl}`,
      );
      this.jobService.setPRCreationResult(prJobId, result);
      this.jobService.updateJobStatus(prJobId, JobStatus.PR_CREATED);

      this.logger.log(`PR creation job ${prJobId} completed successfully: ${result.prUrl}`);
    } catch (error) {
      this.logger.error(`PR creation job ${prJobId} failed: ${error.message}`);
      this.jobService.appendOutput(prJobId, `ERROR: ${error.message}`);
      this.jobService.setJobError(prJobId, error.message);
      this.jobService.updateJobStatus(prJobId, JobStatus.PR_CREATION_FAILED);
    }
  }

  async cleanupJob(jobId: string): Promise<void> {
    const job = this.jobService.getJob(jobId);

    if (job.repositoryPath) {
      this.logger.log(`Cleaning up repository for job ${jobId}`);
      await this.gitService.cleanup(job.repositoryPath);
      this.jobService.appendOutput(jobId, 'Repository cleaned up');
    }

    this.jobService.deleteJob(jobId);
    this.logger.log(`Job ${jobId} deleted`);
  }

  private buildResult(files: FileCoverageDto[]): {
    totalFiles: number;
    averageCoverage: number;
    files: FileCoverageDto[];
  } {
    const totalFiles = files.length;
    const averageCoverage =
      totalFiles > 0
        ? files.reduce((sum, file) => sum + file.coverage, 0) / totalFiles
        : 0;

    return {
      totalFiles,
      averageCoverage: Math.round(averageCoverage * 100) / 100,
      files,
    };
  }
}
