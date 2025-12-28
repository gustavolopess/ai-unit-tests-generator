import { ApiProperty } from '@nestjs/swagger';

export class FileCoverageDto {
  @ApiProperty({
    description: 'Relative file path from repository root',
    example: 'src/utils/helpers.ts',
  })
  file: string;

  @ApiProperty({
    description: 'Coverage percentage for this file',
    example: 85.5,
    minimum: 0,
    maximum: 100,
  })
  coverage: number;
}

export class CoverageResponseDto {
  @ApiProperty({
    description: 'GitHub repository URL',
    example: 'https://github.com/username/repository.git',
  })
  repositoryUrl: string;

  @ApiProperty({
    description: 'Total number of files analyzed',
    example: 15,
  })
  totalFiles: number;

  @ApiProperty({
    description: 'Average coverage percentage across all files',
    example: 67.5,
    minimum: 0,
    maximum: 100,
  })
  averageCoverage: number;

  @ApiProperty({
    description: 'Coverage details for each file',
    type: [FileCoverageDto],
  })
  files: FileCoverageDto[];
}
