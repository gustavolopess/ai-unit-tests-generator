import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { InMemoryTestGenerationRequestRepository } from './infrastructure/in-memory-test-generation-request.repository';
import { AITestGeneratorService } from './infrastructure/ai-test-generator.service';
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
  imports: [CqrsModule],
  providers: [
    {
      provide: TEST_GENERATION_REQUEST_REPOSITORY,
      useClass: InMemoryTestGenerationRequestRepository,
    },
    {
      provide: TEST_GENERATOR,
      useClass: AITestGeneratorService,
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
