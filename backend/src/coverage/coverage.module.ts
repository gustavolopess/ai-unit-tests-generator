import { Module } from '@nestjs/common';
import { CoverageController } from './coverage.controller';

import { JobProcessingModule } from '@/bounded-contexts/job-processing/job-processing.module';
import { GitRepoAnalysisModule } from '@/bounded-contexts/git-repo-analysis/git-repo-analysis.module';
import { TestGenerationModule } from '@/bounded-contexts/test-generation/test-generation.module';

@Module({
  imports: [JobProcessingModule, GitRepoAnalysisModule, TestGenerationModule],
  controllers: [CoverageController],
  providers: [],
})
export class CoverageModule {}
