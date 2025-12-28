import { Module } from '@nestjs/common';
import { CoverageController } from './coverage.controller';
import { CoverageService } from './coverage.service';
import { GitModule } from '../git/git.module';
import { ClaudeModule } from '../claude/claude.module';
import { JobModule } from '../job/job.module';

@Module({
  imports: [GitModule, ClaudeModule, JobModule],
  controllers: [CoverageController],
  providers: [CoverageService],
})
export class CoverageModule {}
