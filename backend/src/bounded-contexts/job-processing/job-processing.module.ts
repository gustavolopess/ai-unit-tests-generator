import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmJobRepository } from './infrastructure/typeorm-job.repository';
import { JobEntity } from './infrastructure/entities/job.entity';
import { JOB_REPOSITORY } from './domain/repositories/job.repository.interface';
import { NPM_SERVICE } from './domain/services/npm-service.interface';
import { GitRepoAnalysisModule } from '@/bounded-contexts/git-repo-analysis/git-repo-analysis.module';
import { TestGenerationModule } from '@/bounded-contexts/test-generation/test-generation.module';
import { NpmService } from './infrastructure/npm.service';

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

const QueryHandlers = [
  GetJobHandler,
  GetAllJobsHandler,
  GetChildJobsHandler,
  GetJobLogsHandler,
];

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([JobEntity]),
    GitRepoAnalysisModule,
    TestGenerationModule,
  ],
  providers: [
    {
      provide: JOB_REPOSITORY,
      useClass: TypeOrmJobRepository,
    },
    {
      provide: NPM_SERVICE,
      useClass: NpmService,
    },
    JobLogService,
    ...CommandHandlers,
    ...QueryHandlers,
    ...Sagas,
  ],
  exports: [JOB_REPOSITORY, CqrsModule, JobLogService],
})
export class JobProcessingModule {}
