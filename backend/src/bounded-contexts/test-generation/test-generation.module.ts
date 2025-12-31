import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmTestGenerationRequestRepository } from './infrastructure/typeorm-test-generation-request.repository';
import { TestGenerationRequestEntity } from './infrastructure/entities/test-generation-request.entity';
import { ClaudeTestGeneratorService } from './infrastructure/claude-test-generator.service';
import { ClaudePullRequestCreatorService } from './infrastructure/claude-pull-request-creator.service';
import { TEST_GENERATION_REQUEST_REPOSITORY } from './domain/repositories/test-generation-request.repository.interface';
import { TEST_GENERATOR } from './domain/services/test-generator.interface';
import { PULL_REQUEST_CREATOR } from './domain/services/pull-request-creator.interface';

// Command Handlers
import {
  GenerateTestsHandler,
  CreatePullRequestHandler,
} from './application/commands';

// Query Handlers
import { GetTestGenerationRequestHandler } from './application/queries';

const CommandHandlers = [GenerateTestsHandler, CreatePullRequestHandler];
const QueryHandlers = [GetTestGenerationRequestHandler];

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([TestGenerationRequestEntity]),
  ],
  providers: [
    {
      provide: TEST_GENERATION_REQUEST_REPOSITORY,
      useClass: TypeOrmTestGenerationRequestRepository,
    },
    {
      provide: TEST_GENERATOR,
      useClass: ClaudeTestGeneratorService,
    },
    {
      provide: PULL_REQUEST_CREATOR,
      useClass: ClaudePullRequestCreatorService,
    },
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [TEST_GENERATION_REQUEST_REPOSITORY, CqrsModule],
})
export class TestGenerationModule {}
