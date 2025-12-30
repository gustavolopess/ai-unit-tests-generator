import { Module } from '@nestjs/common';
import { CoverageController } from './coverage.controller';
import { CoverageService } from './coverage.service';

import { JobProcessingModule } from '../bounded-contexts/job-processing/job-processing.module';
import { RepositoryAnalysisModule } from '../bounded-contexts/repository-analysis/repository-analysis.module';
import { TestGenerationModule } from '../bounded-contexts/test-generation/test-generation.module';

@Module({
  imports: [

    JobProcessingModule,
    RepositoryAnalysisModule,
    TestGenerationModule,
  ],
  controllers: [CoverageController],
  providers: [CoverageService],
})
export class CoverageModule { }
