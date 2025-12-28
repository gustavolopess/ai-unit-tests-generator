import { ApiProperty } from '@nestjs/swagger';
import { JobStatus } from '../../bounded-contexts/job-processing/domain/models/job-status.enum';
import { FileCoverageDto } from './coverage-response.dto';

export class JobCreatedResponseDto {
  @ApiProperty({
    description: 'Unique job identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  jobId: string;

  @ApiProperty({
    description: 'GitHub repository URL',
    example: 'https://github.com/username/repository.git',
  })
  repositoryUrl: string;

  @ApiProperty({
    description: 'Current job status',
    enum: JobStatus,
    example: JobStatus.PENDING,
  })
  status: JobStatus;

  @ApiProperty({
    description: 'Human-readable message about the job',
    example: 'Job created and processing started',
  })
  message: string;
}

export class JobResultResponseDto {
  @ApiProperty({
    description: 'Unique job identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  jobId: string;

  @ApiProperty({
    description: 'GitHub repository URL',
    example: 'https://github.com/username/repository.git',
  })
  repositoryUrl: string;

  @ApiProperty({
    description: 'Current job status',
    enum: JobStatus,
    example: JobStatus.COMPLETED,
  })
  status: JobStatus;

  @ApiProperty({
    description: 'Total number of files analyzed',
    example: 15,
    required: false,
  })
  totalFiles?: number;

  @ApiProperty({
    description: 'Average coverage percentage across all files',
    example: 67.5,
    required: false,
  })
  averageCoverage?: number;

  @ApiProperty({
    description: 'Coverage details for each file',
    type: [FileCoverageDto],
    required: false,
  })
  files?: FileCoverageDto[];

  @ApiProperty({
    description: 'Test generation result',
    required: false,
  })
  testGenerationResult?: {
    filePath: string;
    testFilePath?: string;
    coverage?: number;
  };

  @ApiProperty({
    description: 'PR creation result',
    required: false,
  })
  prCreationResult?: {
    prUrl: string;
    prNumber: number;
  };

  @ApiProperty({
    description: 'Error message if job failed',
    required: false,
  })
  error?: string;

  @ApiProperty({
    description: 'Real-time output log from job execution',
    type: [String],
    example: [
      'Cloning repository...',
      'Starting Claude analysis...',
      'Analysis completed',
    ],
  })
  output: string[];
}
