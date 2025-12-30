import { Injectable, Logger } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { FileCoverageDto } from '../bounded-contexts/job-processing/application/dto/job-response.dto';
import {
  UpdateJobStatusCommand,
  AppendJobLogCommand,
  SetJobErrorCommand,
  SetRepositoryPathCommand,
  SetCoverageResultCommand,
  SetTestGenerationDataCommand,
  SetPRResultCommand,
} from '../bounded-contexts/job-processing/application/commands';
import { GetJobQuery } from '../bounded-contexts/job-processing/application/queries';
import { JobStatus } from '../bounded-contexts/job-processing/domain/models/job-status.enum';
import { Job } from '../bounded-contexts/job-processing/domain/models/job.entity';
import { RepositoryCacheService } from '../bounded-contexts/repository-analysis/infrastructure/repository-cache.service';
import { AnalyzeCoverageCommand } from '../bounded-contexts/repository-analysis/application/commands';
import { GetRepositoryQuery } from '../bounded-contexts/repository-analysis/application/queries';
import { Repository } from '../bounded-contexts/repository-analysis/domain/models/repository.entity';
import {
  GenerateTestsCommand,
  CreatePullRequestCommand,
} from '../bounded-contexts/test-generation/application/commands';
import { TestGenerationRequest } from '../bounded-contexts/test-generation/domain/models/test-generation-request.entity';

const execAsync = promisify(exec);

/**
 * @deprecated This service is deprecated as of the Saga pattern refactoring.
 *
 * The job processing workflow is now handled by the JobProcessingSaga in the
 * job-processing bounded context. The saga orchestrates the workflow through
 * domain events and commands, following DDD best practices.
 *
 * See: backend/src/bounded-contexts/job-processing/application/sagas/job-processing.saga.ts
 *
 * This file is kept for reference but should not be used in new code.
 * It will be removed in a future cleanup.
 */
@Injectable()
export class CoverageService {
  private readonly logger = new Logger(CoverageService.name);
  private readonly coverageThreshold: number = 80; // Default threshold for needsImprovement flag

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly repositoryCache: RepositoryCacheService,
  ) {}

  /**
   * @deprecated Use the JobProcessingSaga instead. Jobs are now processed automatically
   * through event-driven workflow after JobCreatedEvent is published.
   */
  async processJobStages(jobId: string): Promise<void> {
    try {
      let job: Job = await this.queryBus.execute(new GetJobQuery(jobId));

      // Stage 1: Clone repository (if needed)
      if (job.needsCloning()) {
        await this.cloneRepositoryStage(jobId);
        // Refresh job after cloning
        job = await this.queryBus.execute(new GetJobQuery(jobId));
      }

      // Stage 2: Install dependencies (if needed)
      if (job.repositoryPath) {
        await this.installDependenciesStage(jobId);
        // Refresh job after installation
        job = await this.queryBus.execute(new GetJobQuery(jobId));
      }

      // Stage 3: Analyze coverage (if needed)
      if (job.needsCoverageAnalysis()) {
        await this.analyzeCoverageStage(jobId);
        await this.commandBus.execute(
          new UpdateJobStatusCommand(jobId, JobStatus.ANALYSIS_COMPLETED),
        );
        // Refresh job after analysis
        job = await this.queryBus.execute(new GetJobQuery(jobId));
      }

      // Stage 4: Generate tests (if needed and requested)
      if (job.needsTestGeneration()) {
        await this.generateTestsStage(jobId);
        await this.commandBus.execute(
          new UpdateJobStatusCommand(jobId, JobStatus.TEST_GENERATION_COMPLETED),
        );
        // Refresh job after test generation
        job = await this.queryBus.execute(new GetJobQuery(jobId));
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
        new AppendJobLogCommand(jobId, 'All stages completed successfully!'),
      );

      this.logger.log(`Job ${jobId} completed all stages successfully`);
    } catch (error) {
      this.logger.error(`Job ${jobId} failed: ${error.message}`);
      await this.commandBus.execute(
        new AppendJobLogCommand(jobId, `ERROR: ${error.message}`),
      );
      await this.commandBus.execute(
        new SetJobErrorCommand(jobId, error.message),
      );
    }
  }

  private async cloneRepositoryStage(jobId: string): Promise<void> {
    const job: Job = await this.queryBus.execute(new GetJobQuery(jobId));
    const repository: Repository = await this.queryBus.execute(
      new GetRepositoryQuery(job.repositoryId),
    );

    // Check if repository is already cached
    const repositoryUrl = repository.url.getValue();
    const cachedPath = this.repositoryCache.getCachedPath(repositoryUrl);

    if (cachedPath) {
      await this.commandBus.execute(
        new AppendJobLogCommand(
          jobId,
          `Using cached repository at ${cachedPath}`,
        ),
      );
      await this.commandBus.execute(
        new SetRepositoryPathCommand(jobId, cachedPath),
      );
      return;
    }

    await this.commandBus.execute(
      new UpdateJobStatusCommand(jobId, JobStatus.CLONING),
    );
    await this.commandBus.execute(
      new AppendJobLogCommand(
        jobId,
        `Cloning repository ${repositoryUrl}...`,
      ),
    );

    // Repository should already be cloned from controller, just use the path
    const repoPath = repository.localPath!;

    await this.commandBus.execute(
      new AppendJobLogCommand(jobId, `Repository at ${repoPath}`),
    );

    // Cache the repository path
    this.repositoryCache.setCachedPath(repositoryUrl, repoPath);

    // Update job with repository path using command to persist to database
    await this.commandBus.execute(
      new SetRepositoryPathCommand(jobId, repoPath),
    );
  }

  private async installDependenciesStage(jobId: string): Promise<void> {
    const job: Job = await this.queryBus.execute(new GetJobQuery(jobId));

    // Determine working directory based on entrypoint
    const workDir = job.entrypoint
      ? `${job.repositoryPath}/${job.entrypoint}`
      : job.repositoryPath!;

    if (job.entrypoint) {
      await this.commandBus.execute(
        new AppendJobLogCommand(
          jobId,
          `Using entrypoint directory: ${job.entrypoint}`,
        ),
      );
    }

    await this.commandBus.execute(
      new UpdateJobStatusCommand(jobId, JobStatus.INSTALLING),
    );
    await this.commandBus.execute(
      new AppendJobLogCommand(jobId, 'Running npm install...'),
    );

    await this.runNpmInstall(workDir);

    await this.commandBus.execute(
      new AppendJobLogCommand(jobId, 'npm install completed'),
    );
  }

  private async analyzeCoverageStage(jobId: string): Promise<void> {
    const job: Job = await this.queryBus.execute(new GetJobQuery(jobId));
    const repository: Repository = await this.queryBus.execute(
      new GetRepositoryQuery(job.repositoryId),
    );

    if (!job.repositoryPath) {
      throw new Error('Cannot analyze coverage: repository not cloned');
    }

    await this.commandBus.execute(
      new UpdateJobStatusCommand(jobId, JobStatus.ANALYZING),
    );
    await this.commandBus.execute(
      new AppendJobLogCommand(jobId, 'Starting Claude coverage analysis...'),
    );

    // Use Repository Analysis Context to analyze coverage
    // Repository already exists from cloneRepositoryStage

    // Use Repository Analysis Context to analyze coverage
    const analyzedRepository: Repository = await this.commandBus.execute(
      new AnalyzeCoverageCommand(
        repository.id.getValue(),
        job.entrypoint, // Pass entrypoint from job
        async (output: string) => {
          await this.commandBus.execute(
            new AppendJobLogCommand(jobId, output),
          );
        },
      ),
    );

    await this.commandBus.execute(
      new AppendJobLogCommand(
        jobId,
        'Coverage analysis completed, processing results...',
      ),
    );

    // Convert Repository Analysis domain model to Job domain model format
    const fileCoverages: FileCoverageDto[] = analyzedRepository.fileCoverages.map(
      (fc) => ({
        file: fc.filePath,
        coverage: fc.coveragePercentage,
        needsImprovement: fc.coveragePercentage < this.coverageThreshold,
      }),
    );

    const result = this.buildCoverageResult(fileCoverages);

    // Persist coverage result to database using command
    await this.commandBus.execute(
      new SetCoverageResultCommand(jobId, result),
    );

    await this.commandBus.execute(
      new AppendJobLogCommand(
        jobId,
        `Coverage analysis complete: ${result.totalFiles} files, ${result.averageCoverage}% average coverage`,
      ),
    );
  }

  private async generateTestsStage(jobId: string): Promise<void> {
    const job: Job = await this.queryBus.execute(new GetJobQuery(jobId));
    const repository: Repository = await this.queryBus.execute(
      new GetRepositoryQuery(job.repositoryId),
    );

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
      new AppendJobLogCommand(
        jobId,
        `Starting test generation for ${job.targetFilePath}...`,
      ),
    );

    // Use Test Generation Context to generate tests
    const testGenerationRequest: TestGenerationRequest = await this.commandBus.execute(
      new GenerateTestsCommand(
        repository.url.getValue(), // repositoryId
        workDir,
        job.targetFilePath!,
        async (output: string) => {
          await this.commandBus.execute(
            new AppendJobLogCommand(jobId, output),
          );
        },
      ),
    );

    if (testGenerationRequest.sessionId) {
      await this.commandBus.execute(
        new AppendJobLogCommand(
          jobId,
          `Session ID saved: ${testGenerationRequest.sessionId}`,
        ),
      );
    }

    await this.commandBus.execute(
      new AppendJobLogCommand(
        jobId,
        'Test generation completed successfully',
      ),
    );

    // Persist test generation data to database using command
    await this.commandBus.execute(
      new SetTestGenerationDataCommand(
        jobId,
        testGenerationRequest.sessionId,
        testGenerationRequest.id.getValue(),
        {
          filePath: job.targetFilePath!,
          testFilePath: testGenerationRequest.testFilePath,
          coverage: testGenerationRequest.coverage,
        },
      ),
    );
  }

  private async createPRStage(jobId: string): Promise<void> {
    const job: Job = await this.queryBus.execute(new GetJobQuery(jobId));

    if (!job.canCreatePR()) {
      throw new Error(
        'Cannot create PR: tests not generated or session ID missing',
      );
    }

    if (!job.testGenerationRequestId) {
      throw new Error(
        'Cannot create PR: test generation request ID missing',
      );
    }

    await this.commandBus.execute(
      new UpdateJobStatusCommand(jobId, JobStatus.CREATING_PR),
    );
    await this.commandBus.execute(
      new AppendJobLogCommand(
        jobId,
        `Creating pull request using session ${job.sessionId}...`,
      ),
    );

    // Use Test Generation Context to create PR
    const prResult: TestGenerationRequest = await this.commandBus.execute(
      new CreatePullRequestCommand(
        job.testGenerationRequestId,
        async (output: string) => {
          await this.commandBus.execute(
            new AppendJobLogCommand(jobId, output),
          );
        },
      ),
    );

    await this.commandBus.execute(
      new AppendJobLogCommand(
        jobId,
        `Pull request created successfully: ${prResult.pullRequest!.url}`,
      ),
    );

    // Persist PR result to database using command
    await this.commandBus.execute(
      new SetPRResultCommand(jobId, {
        prUrl: prResult.pullRequest!.url,
        prNumber: prResult.pullRequest!.number,
      }),
    );
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
        new AppendJobLogCommand(jobId, 'Repository cleanup skipped (cached for reuse)'),
      );
    }

    this.logger.log(`Job ${jobId} cleanup completed`);
  }
}
