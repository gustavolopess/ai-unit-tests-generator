import { Injectable, Logger } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ClaudeService } from '../claude/claude.service';
import { FileCoverageDto } from './dto/coverage-response.dto';
import {
  UpdateJobStatusCommand,
  AppendJobOutputCommand,
  SetJobErrorCommand,
} from '../bounded-contexts/job-processing/application/commands';
import { GetJobQuery } from '../bounded-contexts/job-processing/application/queries';
import { JobStatus } from '../bounded-contexts/job-processing/domain/models/job-status.enum';
import { Job } from '../bounded-contexts/job-processing/domain/models/job.entity';
import { RepositoryCacheService } from '../bounded-contexts/repository-analysis/infrastructure/repository-cache.service';
import {
  CloneRepositoryCommand,
  AnalyzeCoverageCommand,
} from '../bounded-contexts/repository-analysis/application/commands';
import { Repository } from '../bounded-contexts/repository-analysis/domain/models/repository.entity';

const execAsync = promisify(exec);

@Injectable()
export class CoverageService {
  private readonly logger = new Logger(CoverageService.name);

  constructor(
    private readonly claudeService: ClaudeService,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly repositoryCache: RepositoryCacheService,
  ) {}

  /**
   * Main orchestration method that processes all job stages intelligently
   */
  async processJobStages(jobId: string): Promise<void> {
    try {
      const job: Job = await this.queryBus.execute(new GetJobQuery(jobId));

      // Stage 1: Clone repository (if needed)
      if (job.needsCloning()) {
        await this.cloneRepositoryStage(jobId);
      }

      // Stage 2: Install dependencies (if needed)
      await this.installDependenciesStage(jobId);

      // Stage 3: Analyze coverage (if needed)
      if (job.needsCoverageAnalysis()) {
        await this.analyzeCoverageStage(jobId);
        await this.commandBus.execute(
          new UpdateJobStatusCommand(jobId, JobStatus.ANALYSIS_COMPLETED),
        );
      }

      // Stage 4: Generate tests (if needed and requested)
      if (job.needsTestGeneration()) {
        await this.generateTestsStage(jobId);
        await this.commandBus.execute(
          new UpdateJobStatusCommand(jobId, JobStatus.TEST_GENERATION_COMPLETED),
        );
      }

      // Stage 5: Create PR (if needed and possible)
      if (job.needsPRCreation()) {
        await this.createPRStage(jobId);
        await this.commandBus.execute(
          new UpdateJobStatusCommand(jobId, JobStatus.PR_CREATION_COMPLETED),
        );
      }

      // Mark job as completed
      await this.commandBus.execute(
        new UpdateJobStatusCommand(jobId, JobStatus.COMPLETED),
      );
      await this.commandBus.execute(
        new AppendJobOutputCommand(jobId, 'All stages completed successfully!'),
      );

      this.logger.log(`Job ${jobId} completed all stages successfully`);
    } catch (error) {
      this.logger.error(`Job ${jobId} failed: ${error.message}`);
      await this.commandBus.execute(
        new AppendJobOutputCommand(jobId, `ERROR: ${error.message}`),
      );
      await this.commandBus.execute(
        new SetJobErrorCommand(jobId, error.message),
      );
    }
  }

  private async cloneRepositoryStage(jobId: string): Promise<void> {
    const job: Job = await this.queryBus.execute(new GetJobQuery(jobId));

    // Check if repository is already cached
    const cachedPath = this.repositoryCache.getCachedPath(job.repositoryUrl);

    if (cachedPath) {
      await this.commandBus.execute(
        new AppendJobOutputCommand(
          jobId,
          `Using cached repository at ${cachedPath}`,
        ),
      );
      job.setRepositoryPath(cachedPath);
      return;
    }

    await this.commandBus.execute(
      new UpdateJobStatusCommand(jobId, JobStatus.CLONING),
    );
    await this.commandBus.execute(
      new AppendJobOutputCommand(
        jobId,
        `Cloning repository ${job.repositoryUrl}...`,
      ),
    );

    // Use Repository Analysis Context to clone
    const repository: Repository = await this.commandBus.execute(
      new CloneRepositoryCommand(job.repositoryUrl, job.entrypoint),
    );

    const repoPath = repository.localPath!;

    await this.commandBus.execute(
      new AppendJobOutputCommand(jobId, `Repository cloned to ${repoPath}`),
    );

    // Cache the repository path
    this.repositoryCache.setCachedPath(job.repositoryUrl, repoPath);

    // Update job with repository path and repository ID
    job.setRepositoryPath(repoPath);
  }

  private async installDependenciesStage(jobId: string): Promise<void> {
    const job: Job = await this.queryBus.execute(new GetJobQuery(jobId));

    if (!job.repositoryPath) {
      throw new Error('Cannot install dependencies: repository not cloned');
    }

    // Determine working directory based on entrypoint
    const workDir = job.entrypoint
      ? `${job.repositoryPath}/${job.entrypoint}`
      : job.repositoryPath;

    if (job.entrypoint) {
      await this.commandBus.execute(
        new AppendJobOutputCommand(
          jobId,
          `Using entrypoint directory: ${job.entrypoint}`,
        ),
      );
    }

    await this.commandBus.execute(
      new UpdateJobStatusCommand(jobId, JobStatus.INSTALLING),
    );
    await this.commandBus.execute(
      new AppendJobOutputCommand(jobId, 'Running npm install...'),
    );

    await this.runNpmInstall(workDir);

    await this.commandBus.execute(
      new AppendJobOutputCommand(jobId, 'npm install completed'),
    );
  }

  private async analyzeCoverageStage(jobId: string): Promise<void> {
    const job: Job = await this.queryBus.execute(new GetJobQuery(jobId));

    if (!job.repositoryPath) {
      throw new Error('Cannot analyze coverage: repository not cloned');
    }

    await this.commandBus.execute(
      new UpdateJobStatusCommand(jobId, JobStatus.ANALYZING),
    );
    await this.commandBus.execute(
      new AppendJobOutputCommand(jobId, 'Starting Claude coverage analysis...'),
    );

    // Find the repository in Repository Analysis Context
    // We'll use the cache to find the repository by URL
    const repository: Repository = await this.commandBus.execute(
      new CloneRepositoryCommand(job.repositoryUrl, job.entrypoint),
    );

    // Use Repository Analysis Context to analyze coverage
    const analyzedRepository: Repository = await this.commandBus.execute(
      new AnalyzeCoverageCommand(
        repository.id.getValue(),
        async (output: string) => {
          await this.commandBus.execute(
            new AppendJobOutputCommand(jobId, output),
          );
        },
      ),
    );

    await this.commandBus.execute(
      new AppendJobOutputCommand(
        jobId,
        'Coverage analysis completed, processing results...',
      ),
    );

    // Convert Repository Analysis domain model to Job domain model format
    const fileCoverages: FileCoverageDto[] = analyzedRepository.fileCoverages.map(
      (fc) => ({
        file: fc.filePath,
        coverage: fc.coveragePercentage,
      }),
    );

    const result = this.buildCoverageResult(fileCoverages);
    job.setCoverageResult(result);

    await this.commandBus.execute(
      new AppendJobOutputCommand(
        jobId,
        `Coverage analysis complete: ${result.totalFiles} files, ${result.averageCoverage}% average coverage`,
      ),
    );
  }

  private async generateTestsStage(jobId: string): Promise<void> {
    const job: Job = await this.queryBus.execute(new GetJobQuery(jobId));

    if (!job.canGenerateTests()) {
      throw new Error(
        'Cannot generate tests: repository not cloned or target file not specified',
      );
    }

    const workDir = job.entrypoint
      ? `${job.repositoryPath}/${job.entrypoint}`
      : job.repositoryPath!;

    await this.commandBus.execute(
      new UpdateJobStatusCommand(jobId, JobStatus.GENERATING_TESTS),
    );
    await this.commandBus.execute(
      new AppendJobOutputCommand(
        jobId,
        `Starting test generation for ${job.targetFilePath}...`,
      ),
    );

    const result = await this.claudeService.generateTests(
      workDir,
      job.targetFilePath!,
      async (output: string) => {
        await this.commandBus.execute(
          new AppendJobOutputCommand(jobId, output),
        );
      },
    );

    // Store session ID if available
    if (result.sessionId) {
      job.setSessionId(result.sessionId);
      await this.commandBus.execute(
        new AppendJobOutputCommand(
          jobId,
          `Session ID saved: ${result.sessionId}`,
        ),
      );
    }

    await this.commandBus.execute(
      new AppendJobOutputCommand(
        jobId,
        'Test generation completed successfully',
      ),
    );

    job.setTestGenerationResult({
      filePath: job.targetFilePath!,
      testFilePath: result.testFilePath,
      coverage: result.coverage,
    });
  }

  private async createPRStage(jobId: string): Promise<void> {
    const job: Job = await this.queryBus.execute(new GetJobQuery(jobId));

    if (!job.canCreatePR()) {
      throw new Error(
        'Cannot create PR: tests not generated or session ID missing',
      );
    }

    const workDir = job.entrypoint
      ? `${job.repositoryPath}/${job.entrypoint}`
      : job.repositoryPath!;

    await this.commandBus.execute(
      new UpdateJobStatusCommand(jobId, JobStatus.CREATING_PR),
    );
    await this.commandBus.execute(
      new AppendJobOutputCommand(
        jobId,
        `Creating pull request using session ${job.sessionId}...`,
      ),
    );

    const result = await this.claudeService.createPullRequest(
      workDir,
      job.sessionId!,
      async (output: string) => {
        await this.commandBus.execute(
          new AppendJobOutputCommand(jobId, output),
        );
      },
    );

    await this.commandBus.execute(
      new AppendJobOutputCommand(
        jobId,
        `Pull request created successfully: ${result.prUrl}`,
      ),
    );

    job.setPRCreationResult({
      prUrl: result.prUrl,
      prNumber: result.prNumber,
    });
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

  private buildCoverageResult(files: FileCoverageDto[]): {
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

  async cleanupJob(jobId: string): Promise<void> {
    const job: Job = await this.queryBus.execute(new GetJobQuery(jobId));

    if (job.repositoryPath) {
      this.logger.log(`Cleaning up repository for job ${jobId}`);
      // Cleanup is now handled by the Repository Analysis Context
      // The GitService.cleanup() is currently disabled to allow repository reuse
      await this.commandBus.execute(
        new AppendJobOutputCommand(jobId, 'Repository cleanup skipped (cached for reuse)'),
      );
    }

    this.logger.log(`Job ${jobId} cleanup completed`);
  }
}
