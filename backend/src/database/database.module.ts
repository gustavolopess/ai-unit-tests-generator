import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobEntity } from '../bounded-contexts/job-processing/infrastructure/entities/job.entity';
import { RepositoryEntity } from '../bounded-contexts/repository-analysis/infrastructure/entities/repository.entity';
import { FileCoverageEntity } from '../bounded-contexts/repository-analysis/infrastructure/entities/file-coverage.entity';
import { TestGenerationRequestEntity } from '../bounded-contexts/test-generation/infrastructure/entities/test-generation-request.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE_PATH || 'data/github-coverage.db',
      entities: [
        JobEntity,
        RepositoryEntity,
        FileCoverageEntity,
        TestGenerationRequestEntity,
      ],
      synchronize: true, // Auto-create tables (disable in production, use migrations)
      dropSchema: false, // Don't drop schema on reconnection
      logging: process.env.NODE_ENV === 'development',
      // Retry connection settings
      retryAttempts: 3,
      retryDelay: 3000,
    }),
  ],
})
export class DatabaseModule {}
