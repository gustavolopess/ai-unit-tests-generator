import { TestGenerationRequest } from '@/bounded-contexts/test-generation/domain/models/test-generation-request.entity';
import { TestGenerationId } from '@/bounded-contexts/test-generation/domain/models/test-generation-id.value-object';

export const TEST_GENERATION_REQUEST_REPOSITORY = Symbol(
  'TEST_GENERATION_REQUEST_REPOSITORY',
);

export interface ITestGenerationRequestRepository {
  save(request: TestGenerationRequest): Promise<void>;
  findById(id: TestGenerationId): Promise<TestGenerationRequest | null>;
  findByRepositoryId(repositoryId: string): Promise<TestGenerationRequest[]>;
  delete(id: TestGenerationId): Promise<void>;
}
