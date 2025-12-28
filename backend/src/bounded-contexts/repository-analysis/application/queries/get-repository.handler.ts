import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetRepositoryQuery } from './get-repository.query';
import { Repository } from '../../domain/models/repository.entity';
import { RepositoryId } from '../../domain/models/repository-id.value-object';
import type { IRepositoryRepository } from '../../domain/repositories/repository.repository.interface';
import { REPOSITORY_REPOSITORY } from '../../domain/repositories/repository.repository.interface';

@QueryHandler(GetRepositoryQuery)
export class GetRepositoryHandler implements IQueryHandler<GetRepositoryQuery> {
  constructor(
    @Inject(REPOSITORY_REPOSITORY)
    private readonly repositoryRepository: IRepositoryRepository,
  ) {}

  async execute(query: GetRepositoryQuery): Promise<Repository> {
    const repositoryId = RepositoryId.create(query.repositoryId);
    const repository = await this.repositoryRepository.findById(repositoryId);

    if (!repository) {
      throw new NotFoundException(
        `Repository ${query.repositoryId} not found`,
      );
    }

    return repository;
  }
}
