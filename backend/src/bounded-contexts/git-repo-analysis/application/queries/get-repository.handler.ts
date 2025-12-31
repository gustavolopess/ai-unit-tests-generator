import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetRepositoryQuery } from './get-repository.query';
import { GitRepo } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo.entity';
import { GitRepoId } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo-id.value-object';
import type { IGitRepoRepository } from '@/bounded-contexts/git-repo-analysis/domain/repositories/git-repo.repository.interface';
import { GIT_REPO_REPOSITORY } from '@/bounded-contexts/git-repo-analysis/domain/repositories/git-repo.repository.interface';

@QueryHandler(GetRepositoryQuery)
export class GetRepositoryHandler implements IQueryHandler<GetRepositoryQuery> {
  constructor(
    @Inject(GIT_REPO_REPOSITORY)
    private readonly repositoryRepository: IGitRepoRepository,
  ) {}

  async execute(query: GetRepositoryQuery): Promise<GitRepo> {
    const repositoryId = GitRepoId.create(query.repositoryId);
    const repository = await this.repositoryRepository.findById(repositoryId);

    if (!repository) {
      throw new NotFoundException(`Repository ${query.repositoryId} not found`);
    }

    return repository;
  }
}
