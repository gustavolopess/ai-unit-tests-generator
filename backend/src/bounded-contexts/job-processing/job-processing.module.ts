import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmJobRepository } from './infrastructure/typeorm-job.repository';
import { JobEntity } from './infrastructure/entities/job.entity';
import { JOB_REPOSITORY } from './domain/repositories/job.repository.interface';

// Command Handlers
import {
  CreateJobHandler,
  UpdateJobStatusHandler,
  AppendJobOutputHandler,
  AppendJobLogHandler,
  SetJobErrorHandler,
  SetRepositoryPathHandler,
  SetCoverageResultHandler,
  SetTestGenerationDataHandler,
  SetPRResultHandler,
} from './application/commands';

// Query Handlers
import {
  GetJobHandler,
  GetAllJobsHandler,
  GetChildJobsHandler,
  GetJobLogsHandler,
} from './application/queries';

// Infrastructure services
import { JobLogService } from './infrastructure/job-log.service';

const CommandHandlers = [
  CreateJobHandler,
  UpdateJobStatusHandler,
  AppendJobOutputHandler,
  AppendJobLogHandler,
  SetJobErrorHandler,
  SetRepositoryPathHandler,
  SetCoverageResultHandler,
  SetTestGenerationDataHandler,
  SetPRResultHandler,
];

const QueryHandlers = [GetJobHandler, GetAllJobsHandler, GetChildJobsHandler, GetJobLogsHandler];

@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([JobEntity])],
  providers: [
    {
      provide: JOB_REPOSITORY,
      useClass: TypeOrmJobRepository,
    },
    JobLogService,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [JOB_REPOSITORY, CqrsModule, JobLogService],
})
export class JobProcessingModule {}
