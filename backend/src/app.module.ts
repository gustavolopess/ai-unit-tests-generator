import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { JobHttpModule } from './bounded-contexts/job-processing/infrastructure/http';
import { JobProcessingModule } from './bounded-contexts/job-processing/job-processing.module';

@Module({
  imports: [DatabaseModule, JobProcessingModule, JobHttpModule],
})
export class AppModule {}
