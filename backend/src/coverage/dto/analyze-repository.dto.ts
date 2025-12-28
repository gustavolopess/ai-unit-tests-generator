import { IsNotEmpty, IsString, IsUrl, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AnalyzeRepositoryDto {
  @ApiProperty({
    description: 'GitHub repository URL to analyze',
    example: 'https://github.com/username/repository.git',
  })
  @IsNotEmpty()
  @IsString()
  @IsUrl()
  repositoryUrl: string;

  @ApiProperty({
    description:
      'Optional subdirectory path for monorepos (e.g., "packages/backend"). If not specified, uses repository root.',
    example: 'packages/api',
    required: false,
  })
  @IsOptional()
  @IsString()
  entrypoint?: string;
}
