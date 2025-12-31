import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { CloneRepositoryCommand } from './clone-repository.command';
import { GitRepo } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo.entity';
import { GitRepoUrl } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo-url.value-object';
import type { IGitRepoRepository } from '@/bounded-contexts/git-repo-analysis/domain/repositories/git-repo.repository.interface';
import { GIT_REPO_REPOSITORY } from '@/bounded-contexts/git-repo-analysis/domain/repositories/git-repo.repository.interface';
import type { IGitService } from '@/bounded-contexts/git-repo-analysis/domain/services/git-service.interface';
import { GIT_SERVICE } from '@/bounded-contexts/git-repo-analysis/domain/services/git-service.interface';

@CommandHandler(CloneRepositoryCommand)
export class CloneRepositoryHandler implements ICommandHandler<CloneRepositoryCommand> {
  private readonly logger = new Logger(CloneRepositoryHandler.name);

  constructor(
    @Inject(GIT_REPO_REPOSITORY)
    private readonly repositoryRepository: IGitRepoRepository,
    @Inject(GIT_SERVICE)
    private readonly gitService: IGitService,
  ) {}

  async execute(command: CloneRepositoryCommand): Promise<GitRepo> {
    const { repositoryUrl: urlString } = command;

    this.logger.log(`Cloning repository: ${urlString}`);

    // Create value object
    const repositoryUrl = GitRepoUrl.create(urlString);

    // Check if repository already exists
    let repository = await this.repositoryRepository.findByUrl(repositoryUrl);

    if (!repository) {
      // Create new repository aggregate
      repository = GitRepo.create(repositoryUrl);
    }

    // If already cloned, return it
    if (repository.isCloned()) {
      this.logger.log(`Repository already cloned at: ${repository.localPath}`);
      return repository;
    }

    // Clone the repository
    const localPath = await this.gitService.clone(repositoryUrl.getValue());

    // Mark as cloned (publishes RepositoryClonedEvent)
    repository.markAsCloned(localPath);

    // Save to repository
    await this.repositoryRepository.save(repository);

    this.logger.log(`Repository cloned successfully to: ${localPath}`);

    return repository;
  }
}
