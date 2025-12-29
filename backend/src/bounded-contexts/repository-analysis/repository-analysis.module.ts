import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RepositoryCacheService } from './infrastructure/repository-cache.service';
import { RepositoryCacheController } from './repository-cache.controller';
import { TypeOrmRepositoryRepository } from './infrastructure/typeorm-repository.repository';
import { RepositoryEntity } from './infrastructure/entities/repository.entity';
import { FileCoverageEntity } from './infrastructure/entities/file-coverage.entity';
import { GitService } from './infrastructure/git.service';
import { CoverageAnalyzerService } from './infrastructure/coverage-analyzer.service';
import { REPOSITORY_REPOSITORY } from './domain/repositories/repository.repository.interface';
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
    TypeOrmModule.forFeature([RepositoryEntity, FileCoverageEntity]),
  ],
  controllers: [RepositoryCacheController],
  providers: [
    {
      provide: REPOSITORY_REPOSITORY,
      useClass: TypeOrmRepositoryRepository,
    },
    {
      provide: GIT_SERVICE,
      useClass: GitService,
    },
    {
      provide: COVERAGE_ANALYZER,
      useClass: CoverageAnalyzerService,
    },
    RepositoryCacheService,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [REPOSITORY_REPOSITORY, CqrsModule, RepositoryCacheService],
})
export class RepositoryAnalysisModule {}
