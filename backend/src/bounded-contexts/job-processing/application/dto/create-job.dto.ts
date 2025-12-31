import {
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  ValidateIf,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsSecurePath } from '@/shared/validators/is-secure-path.validator';

export class CreateJobDto {
  @ApiProperty({
    description:
      "Optional existing job ID to continue from. When provided, the system will reuse the existing job's repository and analysis results, skipping already completed stages. If jobId is provided, repositoryUrl and entrypoint are not required.",
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  jobId?: string;

  @ApiProperty({
    description:
      'GitHub repository URL to analyze. Required when jobId is not provided.',
    example: 'https://github.com/username/repository.git',
    required: false,
  })
  @ValidateIf((o) => !o.jobId)
  @IsString()
  @IsUrl()
  repositoryUrl?: string;

  @ApiProperty({
    description:
      'Optional subdirectory path for monorepos (e.g., "packages/backend"). If not specified, uses repository root. Must be a relative path without traversal sequences.',
    example: 'packages/api',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @IsSecurePath({
    message:
      'entrypoint must be a valid relative path without "..", absolute paths, or special characters',
  })
  entrypoint?: string;

  @ApiProperty({
    description:
      'Optional file path for test generation (e.g., "src/services/user.service.ts"). If provided, the job will generate tests for this file and optionally create a PR. Must be a relative path without traversal sequences.',
    example: 'src/services/auth.service.ts',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsSecurePath({
    message:
      'targetFilePath must be a valid relative path without "..", absolute paths, or special characters',
  })
  targetFilePath?: string;
}
