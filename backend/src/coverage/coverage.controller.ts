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
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CoverageService } from './coverage.service';
import { CreateJobDto } from './dto/create-job.dto';
import {
  JobCreatedResponseDto,
  JobResultResponseDto,
} from './dto/job-response.dto';
import { CreateJobCommand } from '../bounded-contexts/job-processing/application/commands';
import { GetJobQuery } from '../bounded-contexts/job-processing/application/queries';
import { Job } from '../bounded-contexts/job-processing/domain/models/job.entity';

@ApiTags('jobs')
@Controller('jobs')
export class CoverageController {
  constructor(
    private readonly coverageService: CoverageService,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Create and start a job',
    description:
      'Creates a job that can perform coverage analysis, test generation, and PR creation. The system automatically determines and executes the necessary stages based on what is provided. You can optionally provide a parentJobId with a targetFilePath to create a child job that reuses the parent\'s coverage analysis results, skipping the cloning, installation, and analysis stages.',
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Job created and started',
    type: JobCreatedResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request body',
  })
  async createJob(
    @Body() dto: CreateJobDto,
  ): Promise<JobCreatedResponseDto> {
    let job: Job;

    if (dto.jobId) {
      // Fetch parent job to get repository details and create a child job
      const parentJob = await this.queryBus.execute(new GetJobQuery(dto.jobId));

      // Create a new child job that references the parent
      job = await this.commandBus.execute(
        new CreateJobCommand(
          parentJob.repositoryUrl,
          parentJob.entrypoint,
          dto.targetFilePath,
          dto.jobId, // parentJobId
        ),
      );
    } else {
      // Create new job - repositoryUrl is required when jobId is not provided
      if (!dto.repositoryUrl) {
        throw new Error('repositoryUrl is required when jobId is not provided');
      }
      job = await this.commandBus.execute(
        new CreateJobCommand(dto.repositoryUrl, dto.entrypoint, dto.targetFilePath),
      );
    }

    // Start async processing
    this.coverageService.processJobStages(job.id.getValue()).catch((error) => {
      console.error(`Unhandled error in job ${job.id.getValue()}:`, error);
    });

    return {
      jobId: job.id.getValue(),
      repositoryUrl: job.repositoryUrl,
      status: job.status,
      message: dto.jobId
        ? `Created child job ${job.id.getValue()} for test generation (reusing analysis from ${dto.jobId})`
        : `Job created${dto.targetFilePath ? ' for test generation and PR creation' : ' for coverage analysis'}`,
    };
  }

  @Get(':jobId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get job result',
    description:
      'Retrieves the status and results of a job. Poll this endpoint to monitor job progress and get real-time output.',
  })
  @ApiParam({
    name: 'jobId',
    description: 'The job identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job result retrieved successfully',
    type: JobResultResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  async getJobResult(@Param('jobId') jobId: string): Promise<JobResultResponseDto> {
    const job: Job = await this.queryBus.execute(new GetJobQuery(jobId));

    return {
      jobId: job.id.getValue(),
      parentJobId: job.parentJobId,
      repositoryUrl: job.repositoryUrl,
      status: job.status,
      totalFiles: job.coverageResult?.totalFiles,
      averageCoverage: job.coverageResult?.averageCoverage,
      files: job.coverageResult?.files,
      testGenerationResult: job.testGenerationResult,
      prCreationResult: job.prCreationResult,
      error: job.error,
      output: job.output,
    };
  }
}
