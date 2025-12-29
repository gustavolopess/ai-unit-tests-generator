import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { CoverageModule } from './coverage/coverage.module';
import { JobProcessingModule } from './bounded-contexts/job-processing/job-processing.module';

@Module({
  imports: [DatabaseModule, JobProcessingModule, CoverageModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
