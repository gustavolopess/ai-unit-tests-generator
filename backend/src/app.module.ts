import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { CoverageModule } from './coverage/coverage.module';
import { JobProcessingModule } from './bounded-contexts/job-processing/job-processing.module';

@Module({
  imports: [DatabaseModule, JobProcessingModule, CoverageModule],
})
export class AppModule {}
