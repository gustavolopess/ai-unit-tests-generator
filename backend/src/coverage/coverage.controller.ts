import {
  Body,
  Controller,
  Post,
  Get,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { CoverageService } from './coverage.service';
import { JobService } from '../job/job.service';
import { AnalyzeRepositoryDto } from './dto/analyze-repository.dto';
import {
  JobCreatedResponseDto,
  JobResultResponseDto,
} from './dto/job-response.dto';
import { GenerateTestsDto } from './dto/generate-tests.dto';
import { CreatePRDto } from './dto/create-pr.dto';

@ApiTags('jobs')
@Controller('jobs')
export class CoverageController {
  constructor(
    private readonly coverageService: CoverageService,
    private readonly jobService: JobService,
  ) {}

  @Post('coverage-analyzer/start')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Start coverage analysis',
    description:
      'Creates and starts a coverage analyzer job for a GitHub repository. The job clones the repository and analyzes test coverage using Claude CLI.',
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Coverage analyzer job created and started',
    type: JobCreatedResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request body',
  })
  async startCoverageAnalyzer(
    @Body() dto: AnalyzeRepositoryDto,
  ): Promise<JobCreatedResponseDto> {
    const job = this.jobService.createJob(dto.repositoryUrl, dto.entrypoint);

    this.coverageService.processJobAsync(job.id).catch((error) => {
      console.error(`Unhandled error in job ${job.id}:`, error);
    });

    return {
      jobId: job.id,
      repositoryUrl: job.repositoryUrl,
      status: job.status,
      message: `Coverage analyzer job created and started${dto.entrypoint ? ` with entrypoint ${dto.entrypoint}` : ''}`,
    };
  }

  @Get('coverage-analyzer/:jobId/result')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get coverage analyzer job result',
    description:
      'Retrieves the status and results of a coverage analyzer job. Poll this endpoint to monitor job progress and get real-time output.',
  })
  @ApiParam({
    name: 'jobId',
    description: 'The coverage analyzer job identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Coverage analyzer job result retrieved successfully',
    type: JobResultResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  async getCoverageAnalyzerResult(@Param('jobId') jobId: string): Promise<JobResultResponseDto> {
    const job = this.jobService.getJob(jobId);

    return {
      jobId: job.id,
      repositoryUrl: job.repositoryUrl,
      status: job.status,
      totalFiles: job.result?.totalFiles,
      averageCoverage: job.result?.averageCoverage,
      files: job.result?.files,
      error: job.error,
      output: job.output,
    };
  }

  @Post('tests-generator/start')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Start test generation',
    description:
      'Creates and starts a test generator job for a specific file. Uses Claude CLI to automatically generate comprehensive unit tests.',
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Test generator job created and started',
    type: JobCreatedResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Coverage analyzer job not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Coverage analyzer job not completed or repository not available',
  })
  async startTestGenerator(
    @Body() dto: GenerateTestsDto,
  ): Promise<JobCreatedResponseDto> {
    const testJob = this.jobService.createTestGenerationJob(
      dto.coverageAnalyzerJobId,
      dto.filePath,
    );

    this.coverageService
      .processTestGenerationJobAsync(testJob.id)
      .catch((error) => {
        console.error(`Unhandled error in test generator job ${testJob.id}:`, error);
      });

    return {
      jobId: testJob.id,
      repositoryUrl: testJob.repositoryUrl,
      status: testJob.status,
      message: `Test generator job created for ${dto.filePath}`,
    };
  }

  @Get('tests-generator/:jobId/result')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get test generator job result',
    description:
      'Retrieves the status and results of a test generator job, including session ID and test file details.',
  })
  @ApiParam({
    name: 'jobId',
    description: 'The test generator job identifier',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Test generator job result retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  async getTestGeneratorResult(
    @Param('jobId') jobId: string,
  ): Promise<{
    jobId: string;
    repositoryUrl: string;
    status: string;
    parentJobId?: string;
    targetFilePath?: string;
    testGenerationResult?: {
      filePath: string;
      summary: string;
      testFilePath?: string;
      coverage?: number;
    };
    error?: string;
    output: string[];
  }> {
    const job = this.jobService.getJob(jobId);

    return {
      jobId: job.id,
      repositoryUrl: job.repositoryUrl,
      status: job.status,
      parentJobId: job.parentJobId,
      targetFilePath: job.targetFilePath,
      testGenerationResult: job.testGenerationResult,
      error: job.error,
      output: job.output,
    };
  }

  @Post('pr-creator/start')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Start PR creation',
    description:
      'Creates and starts a PR creator job that uses the Claude session from test generation to create a GitHub pull request with the generated tests.',
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'PR creator job created and started',
    type: JobCreatedResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Test generator job not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Test generator job not completed or missing session ID',
  })
  async startPRCreator(
    @Body() dto: CreatePRDto,
  ): Promise<JobCreatedResponseDto> {
    const prJob = this.jobService.createPRCreationJob(dto.testGeneratorJobId);

    this.coverageService
      .processPRCreationJobAsync(prJob.id)
      .catch((error) => {
        console.error(`Unhandled error in PR creator job ${prJob.id}:`, error);
      });

    return {
      jobId: prJob.id,
      repositoryUrl: prJob.repositoryUrl,
      status: prJob.status,
      message: 'PR creator job created and started',
    };
  }

  @Get('pr-creator/:jobId/result')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get PR creator job result',
    description:
      'Retrieves the status and results of a PR creator job, including the pull request URL and number.',
  })
  @ApiParam({
    name: 'jobId',
    description: 'The PR creator job identifier',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'PR creator job result retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  async getPRCreatorResult(
    @Param('jobId') jobId: string,
  ): Promise<{
    jobId: string;
    repositoryUrl: string;
    status: string;
    parentJobId?: string;
    prCreationResult?: {
      prUrl: string;
      prNumber: number;
      summary: string;
    };
    error?: string;
    output: string[];
  }> {
    const job = this.jobService.getJob(jobId);

    return {
      jobId: job.id,
      repositoryUrl: job.repositoryUrl,
      status: job.status,
      parentJobId: job.parentJobId,
      prCreationResult: job.prCreationResult,
      error: job.error,
      output: job.output,
    };
  }
}
