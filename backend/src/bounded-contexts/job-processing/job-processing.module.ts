import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { InMemoryJobRepository } from './infrastructure/in-memory-job.repository';
import { JOB_REPOSITORY } from './domain/repositories/job.repository.interface';

// Command Handlers
import {
  CreateJobHandler,
  UpdateJobStatusHandler,
  AppendJobOutputHandler,
  SetJobErrorHandler,
} from './application/commands';

// Query Handlers
import {
  GetJobHandler,
  GetAllJobsHandler,
  GetChildJobsHandler,
} from './application/queries';

const CommandHandlers = [
  CreateJobHandler,
  UpdateJobStatusHandler,
  AppendJobOutputHandler,
  SetJobErrorHandler,
];

const QueryHandlers = [GetJobHandler, GetAllJobsHandler, GetChildJobsHandler];

@Module({
  imports: [CqrsModule],
  providers: [
    {
      provide: JOB_REPOSITORY,
      useClass: InMemoryJobRepository,
    },
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [JOB_REPOSITORY, CqrsModule],
})
export class JobProcessingModule {}
