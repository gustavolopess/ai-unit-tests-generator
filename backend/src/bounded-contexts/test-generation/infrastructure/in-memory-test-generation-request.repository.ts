import { Injectable } from '@nestjs/common';
import { ITestGenerationRequestRepository } from '../domain/repositories/test-generation-request.repository.interface';
import { TestGenerationRequest } from '../domain/models/test-generation-request.entity';
import { TestGenerationId } from '../domain/models/test-generation-id.value-object';

@Injectable()
export class InMemoryTestGenerationRequestRepository
  implements ITestGenerationRequestRepository
{
  private readonly requests = new Map<string, TestGenerationRequest>();

  async save(request: TestGenerationRequest): Promise<void> {
    this.requests.set(request.id.getValue(), request);
  }

  async findById(id: TestGenerationId): Promise<TestGenerationRequest | null> {
    return this.requests.get(id.getValue()) || null;
  }

  async findByRepositoryId(repositoryId: string): Promise<TestGenerationRequest[]> {
    const results: TestGenerationRequest[] = [];

    for (const request of this.requests.values()) {
      if (request.repositoryId === repositoryId) {
        results.push(request);
      }
    }

    return results;
  }

  async delete(id: TestGenerationId): Promise<void> {
    this.requests.delete(id.getValue());
  }
}
