import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ITestGenerationRequestRepository } from '../domain/repositories/test-generation-request.repository.interface';
import { TestGenerationRequest } from '../domain/models/test-generation-request.entity';
import { TestGenerationId } from '../domain/models/test-generation-id.value-object';
import { FilePath } from '../domain/models/file-path.value-object';
import { TestGenerationRequestEntity } from './entities/test-generation-request.entity';
import { TestGenerationStatus } from '../domain/models/test-generation-request.entity';

@Injectable()
export class TypeOrmTestGenerationRequestRepository
  implements ITestGenerationRequestRepository
{
  private readonly logger = new Logger(TypeOrmTestGenerationRequestRepository.name);

  constructor(
    @InjectRepository(TestGenerationRequestEntity)
    private readonly repository: Repository<TestGenerationRequestEntity>,
  ) {}

  async save(request: TestGenerationRequest): Promise<void> {
    const entity = this.toEntity(request);
    await this.repository.save(entity);
    this.logger.log(`Test generation request saved: ${request.id.getValue()}`);
  }

  async findById(id: TestGenerationId): Promise<TestGenerationRequest | null> {
    const entity = await this.repository.findOne({
      where: { id: id.getValue() },
    });

    if (!entity) {
      this.logger.warn(`Test generation request not found: ${id.getValue()}`);
      return null;
    }

    this.logger.log(`Test generation request found: ${id.getValue()}`);
    return this.toDomain(entity);
  }

  async findByRepositoryId(repositoryId: string): Promise<TestGenerationRequest[]> {
    const entities = await this.repository.find({
      where: { repositoryId },
      order: { createdAt: 'DESC' },
    });

    this.logger.log(
      `Found ${entities.length} test generation requests for repository ${repositoryId}`,
    );
    return entities.map((entity) => this.toDomain(entity));
  }

  async delete(id: TestGenerationId): Promise<void> {
    const result = await this.repository.delete(id.getValue());
    if (result.affected && result.affected > 0) {
      this.logger.log(`Test generation request deleted: ${id.getValue()}`);
    } else {
      this.logger.warn(
        `Test generation request not found for deletion: ${id.getValue()}`,
      );
    }
  }

  // Mapper methods
  private toEntity(request: TestGenerationRequest): TestGenerationRequestEntity {
    const entity = new TestGenerationRequestEntity();
    entity.id = request.id.getValue();
    entity.repositoryId = request.repositoryId;
    entity.targetFilePath = request.targetFilePath.getValue();
    entity.workingDirectory = request.workingDirectory;
    entity.status = request.status;
    entity.createdAt = request.createdAt;
    entity.completedAt = request.completedAt;
    entity.sessionId = request.sessionId;
    entity.testFilePath = request.testFilePath;
    entity.coverage = request.coverage;
    entity.error = request.error;
    entity.pullRequest = request.pullRequest;
    return entity;
  }

  private toDomain(entity: TestGenerationRequestEntity): TestGenerationRequest {
    const id = TestGenerationId.create(entity.id);
    const targetFilePath = FilePath.create(entity.targetFilePath);

    return TestGenerationRequest.reconstitute(id, {
      repositoryId: entity.repositoryId,
      targetFilePath,
      workingDirectory: entity.workingDirectory,
      status: entity.status as TestGenerationStatus,
      createdAt: entity.createdAt,
      completedAt: entity.completedAt,
      sessionId: entity.sessionId,
      testFilePath: entity.testFilePath,
      coverage: entity.coverage,
      error: entity.error,
      pullRequest: entity.pullRequest,
    });
  }
}
