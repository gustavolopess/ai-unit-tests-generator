import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmGitRepoRepository } from './infrastructure/typeorm-git-repo.repository';
import { GitRepoEntity } from './infrastructure/entities/git-repo.entity';
import { FileCoverageEntity } from './infrastructure/entities/file-coverage.entity';
import { GitService } from './infrastructure/git.service';
import { ClaudeCoverageAnalyzerService } from './infrastructure/claude-coverage-analyzer.service';
import { LockCleanupService } from './infrastructure/lock-cleanup.service';
import { GIT_REPO_REPOSITORY } from './domain/repositories/git-repo.repository.interface';
import { GIT_SERVICE } from './domain/services/git-service.interface';
import { COVERAGE_ANALYZER } from './domain/services/coverage-analyzer.interface';

// Command Handlers
import {
  CloneRepositoryHandler,
  AnalyzeCoverageHandler,
} from './application/commands';

// Query Handlers
import { GetRepositoryHandler } from './application/queries';

const CommandHandlers = [CloneRepositoryHandler, AnalyzeCoverageHandler];
const QueryHandlers = [GetRepositoryHandler];

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([GitRepoEntity, FileCoverageEntity]),
  ],
  providers: [
    {
      provide: GIT_REPO_REPOSITORY,
      useClass: TypeOrmGitRepoRepository,
    },
    {
      provide: GIT_SERVICE,
      useClass: GitService,
    },
    {
      provide: COVERAGE_ANALYZER,
      useClass: ClaudeCoverageAnalyzerService,
    },
    LockCleanupService,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [GIT_REPO_REPOSITORY, CqrsModule],
})
export class GitRepoAnalysisModule {}
