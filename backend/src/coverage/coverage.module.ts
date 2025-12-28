import { Module } from '@nestjs/common';
import { CoverageController } from './coverage.controller';
import { CoverageService } from './coverage.service';
import { ClaudeModule } from '../claude/claude.module';
import { JobModule } from '../job/job.module';
import { JobProcessingModule } from '../bounded-contexts/job-processing/job-processing.module';
import { RepositoryAnalysisModule } from '../bounded-contexts/repository-analysis/repository-analysis.module';

@Module({
  imports: [
    ClaudeModule,
    JobModule,
    JobProcessingModule,
    RepositoryAnalysisModule,
  ],
  controllers: [CoverageController],
  providers: [CoverageService],
})
export class CoverageModule {}
