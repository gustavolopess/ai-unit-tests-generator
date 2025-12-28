import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateTestsDto {
  @ApiProperty({
    description: 'Coverage analyzer job ID (must be completed)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty()
  @IsString()
  coverageAnalyzerJobId: string;

  @ApiProperty({
    description: 'Relative path to the file to generate tests for',
    example: 'src/utils/helpers.ts',
  })
  @IsNotEmpty()
  @IsString()
  filePath: string;
}
