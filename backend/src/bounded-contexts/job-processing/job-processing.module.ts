import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmJobRepository } from './infrastructure/typeorm-job.repository';
import { JobEntity } from './infrastructure/entities/job.entity';
import { JOB_REPOSITORY } from './domain/repositories/job.repository.interface';
import { RepositoryAnalysisModule } from '../repository-analysis/repository-analysis.module';
import { TestGenerationModule } from '../test-generation/test-generation.module';

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
  SetRepositoryPathForJobHandler,
  InstallDependenciesHandler,
  AnalyzeCoverageForJobHandler,
  GenerateTestsForJobHandler,
  CreatePRForJobHandler,
  CompleteJobHandler,
  FailJobHandler,
} from './application/commands';

// Sagas
import { JobProcessingSaga } from './application/sagas/job-processing.saga';

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
  SetRepositoryPathForJobHandler,
  InstallDependenciesHandler,
  AnalyzeCoverageForJobHandler,
  GenerateTestsForJobHandler,
  CreatePRForJobHandler,
  CompleteJobHandler,
  FailJobHandler,
];

const Sagas = [JobProcessingSaga];

const QueryHandlers = [GetJobHandler, GetAllJobsHandler, GetChildJobsHandler, GetJobLogsHandler];

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([JobEntity]),
    RepositoryAnalysisModule,
    TestGenerationModule,
  ],
  providers: [
    {
      provide: JOB_REPOSITORY,
      useClass: TypeOrmJobRepository,
    },
    JobLogService,
    ...CommandHandlers,
    ...QueryHandlers,
    ...Sagas,
  ],
  exports: [JOB_REPOSITORY, CqrsModule, JobLogService],
})
export class JobProcessingModule {}
