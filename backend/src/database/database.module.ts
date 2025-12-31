import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobEntity } from '@/bounded-contexts/job-processing/infrastructure/entities/job.entity';
import { GitRepoEntity } from '@/bounded-contexts/git-repo-analysis/infrastructure/entities/git-repo.entity';
import { FileCoverageEntity } from '@/bounded-contexts/git-repo-analysis/infrastructure/entities/file-coverage.entity';
import { TestGenerationRequestEntity } from '@/bounded-contexts/test-generation/infrastructure/entities/test-generation-request.entity';
import { AppConfig } from '@/shared/config/app.config';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: AppConfig.database.path,
      entities: [
        JobEntity,
        GitRepoEntity,
        FileCoverageEntity,
        TestGenerationRequestEntity,
      ],
      synchronize: AppConfig.database.synchronize,
      dropSchema: false,
      logging: AppConfig.database.logging,
      retryAttempts: 3,
      retryDelay: 3000,
    }),
  ],
})
export class DatabaseModule {}
