import { Module } from '@nestjs/common';
import { JobController } from './job.controller';

import { JobProcessingModule } from '@/bounded-contexts/job-processing/job-processing.module';
import { GitRepoAnalysisModule } from '@/bounded-contexts/git-repo-analysis/git-repo-analysis.module';
import { TestGenerationModule } from '@/bounded-contexts/test-generation/test-generation.module';

@Module({
  imports: [JobProcessingModule, GitRepoAnalysisModule, TestGenerationModule],
  controllers: [JobController],
  providers: [],
})
export class JobHttpModule {}
