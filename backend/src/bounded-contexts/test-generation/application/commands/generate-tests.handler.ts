import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { GenerateTestsCommand } from './generate-tests.command';
import { TestGenerationRequest } from '@/bounded-contexts/test-generation/domain/models/test-generation-request.entity';
import { FilePath } from '@/bounded-contexts/test-generation/domain/models/file-path.value-object';
import type { ITestGenerationRequestRepository } from '@/bounded-contexts/test-generation/domain/repositories/test-generation-request.repository.interface';
import { TEST_GENERATION_REQUEST_REPOSITORY } from '@/bounded-contexts/test-generation/domain/repositories/test-generation-request.repository.interface';
import type { ITestGenerator } from '@/bounded-contexts/test-generation/domain/services/test-generator.interface';
import { TEST_GENERATOR } from '@/bounded-contexts/test-generation/domain/services/test-generator.interface';

@CommandHandler(GenerateTestsCommand)
export class GenerateTestsHandler implements ICommandHandler<GenerateTestsCommand> {
  private readonly logger = new Logger(GenerateTestsHandler.name);

  constructor(
    @Inject(TEST_GENERATION_REQUEST_REPOSITORY)
    private readonly requestRepository: ITestGenerationRequestRepository,
    @Inject(TEST_GENERATOR)
    private readonly testGenerator: ITestGenerator,
  ) {}

  async execute(command: GenerateTestsCommand): Promise<TestGenerationRequest> {
    const { repositoryId, workingDirectory, targetFilePath, onOutput } =
      command;

    this.logger.log(
      `Generating tests for ${targetFilePath} in repository ${repositoryId}`,
    );

    // Create value object
    const filePathVO = FilePath.create(targetFilePath);

    // Create test generation request aggregate
    const request = TestGenerationRequest.create(
      repositoryId,
      filePathVO,
      workingDirectory,
    );

    // Mark as generating
    request.markAsGenerating();

    // Save initial state
    await this.requestRepository.save(request);

    try {
      // Generate tests using domain service
      const result = await this.testGenerator.generateTests(
        workingDirectory,
        targetFilePath,
        onOutput,
      );

      // Complete generation (publishes TestsGeneratedEvent)
      request.completeGeneration(
        result.sessionId,
        result.testFilePath,
        result.coverage,
      );

      // Save completed state
      await this.requestRepository.save(request);

      this.logger.log(
        `Tests generated successfully for ${targetFilePath}, session: ${result.sessionId}`,
      );

      return request;
    } catch (error) {
      this.logger.error(`Test generation failed: ${error.message}`);
      request.fail(error.message);
      await this.requestRepository.save(request);
      throw error;
    }
  }
}
