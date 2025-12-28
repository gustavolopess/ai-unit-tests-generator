import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetTestGenerationRequestQuery } from './get-test-generation-request.query';
import { TestGenerationRequest } from '../../domain/models/test-generation-request.entity';
import { TestGenerationId } from '../../domain/models/test-generation-id.value-object';
import type { ITestGenerationRequestRepository } from '../../domain/repositories/test-generation-request.repository.interface';
import { TEST_GENERATION_REQUEST_REPOSITORY } from '../../domain/repositories/test-generation-request.repository.interface';

@QueryHandler(GetTestGenerationRequestQuery)
export class GetTestGenerationRequestHandler
  implements IQueryHandler<GetTestGenerationRequestQuery>
{
  constructor(
    @Inject(TEST_GENERATION_REQUEST_REPOSITORY)
    private readonly requestRepository: ITestGenerationRequestRepository,
  ) {}

  async execute(
    query: GetTestGenerationRequestQuery,
  ): Promise<TestGenerationRequest> {
    const requestId = TestGenerationId.create(query.requestId);
    const request = await this.requestRepository.findById(requestId);

    if (!request) {
      throw new NotFoundException(
        `Test generation request ${query.requestId} not found`,
      );
    }

    return request;
  }
}
