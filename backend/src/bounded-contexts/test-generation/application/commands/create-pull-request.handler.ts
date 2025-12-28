import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { CreatePullRequestCommand } from './create-pull-request.command';
import { TestGenerationRequest } from '../../domain/models/test-generation-request.entity';
import { TestGenerationId } from '../../domain/models/test-generation-id.value-object';
import type { ITestGenerationRequestRepository } from '../../domain/repositories/test-generation-request.repository.interface';
import { TEST_GENERATION_REQUEST_REPOSITORY } from '../../domain/repositories/test-generation-request.repository.interface';
import type { IPullRequestCreator } from '../../domain/services/pull-request-creator.interface';
import { PULL_REQUEST_CREATOR } from '../../domain/services/pull-request-creator.interface';

@CommandHandler(CreatePullRequestCommand)
export class CreatePullRequestHandler
  implements ICommandHandler<CreatePullRequestCommand>
{
  private readonly logger = new Logger(CreatePullRequestHandler.name);

  constructor(
    @Inject(TEST_GENERATION_REQUEST_REPOSITORY)
    private readonly requestRepository: ITestGenerationRequestRepository,
    @Inject(PULL_REQUEST_CREATOR)
    private readonly pullRequestCreator: IPullRequestCreator,
  ) {}

  async execute(
    command: CreatePullRequestCommand,
  ): Promise<TestGenerationRequest> {
    const { testGenerationRequestId, onOutput } = command;

    this.logger.log(`Creating pull request for request ${testGenerationRequestId}`);

    // Get test generation request
    const requestId = TestGenerationId.create(testGenerationRequestId);
    const request = await this.requestRepository.findById(requestId);

    if (!request) {
      throw new NotFoundException(
        `Test generation request ${testGenerationRequestId} not found`,
      );
    }

    if (!request.canCreatePullRequest()) {
      throw new Error(
        'Cannot create pull request: tests must be generated and no PR exists yet',
      );
    }

    // Create pull request using domain service
    const result = await this.pullRequestCreator.createPullRequest(
      request.workingDirectory,
      request.sessionId!,
      onOutput,
    );

    // Set PR info (publishes PullRequestCreatedEvent)
    request.setPullRequest(result.prUrl, result.prNumber);

    // Save updated state
    await this.requestRepository.save(request);

    this.logger.log(
      `Pull request created successfully: ${result.prUrl} (#${result.prNumber})`,
    );

    return request;
  }
}
