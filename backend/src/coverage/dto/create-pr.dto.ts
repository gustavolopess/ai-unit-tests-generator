import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePRDto {
  @ApiProperty({
    description: 'Test generator job ID (must be completed)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsNotEmpty()
  @IsString()
  testGeneratorJobId: string;
}
