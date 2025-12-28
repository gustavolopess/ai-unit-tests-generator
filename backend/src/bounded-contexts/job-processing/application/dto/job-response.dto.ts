import { ApiProperty } from '@nestjs/swagger';
import { Job } from '../../domain/models/job.entity';
import { JobStatus } from '../../domain/models/job-status.enum';

export class JobResponseDto {
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
  })
  status: JobStatus;

  @ApiProperty({ description: 'Job creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiProperty({ description: 'Job start timestamp', required: false })
  startedAt?: Date;

  @ApiProperty({ description: 'Job completion timestamp', required: false })
  completedAt?: Date;

  @ApiProperty({ description: 'Error message if job failed', required: false })
  error?: string;

  @ApiProperty({
    description: 'Real-time output log from job execution',
    type: [String],
  })
  output: string[];

  static fromDomain(job: Job): JobResponseDto {
    return {
      jobId: job.id.getValue(),
      repositoryUrl: job.repositoryUrl,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      output: job.output,
    };
  }
}
