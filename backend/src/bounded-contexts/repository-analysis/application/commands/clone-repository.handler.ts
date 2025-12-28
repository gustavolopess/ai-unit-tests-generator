import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { CloneRepositoryCommand } from './clone-repository.command';
import { Repository } from '../../domain/models/repository.entity';
import { RepositoryUrl } from '../../domain/models/repository-url.value-object';
import type { IRepositoryRepository } from '../../domain/repositories/repository.repository.interface';
import { REPOSITORY_REPOSITORY } from '../../domain/repositories/repository.repository.interface';
import type { IGitService } from '../../domain/services/git-service.interface';
import { GIT_SERVICE } from '../../domain/services/git-service.interface';

@CommandHandler(CloneRepositoryCommand)
export class CloneRepositoryHandler
  implements ICommandHandler<CloneRepositoryCommand>
{
  private readonly logger = new Logger(CloneRepositoryHandler.name);

  constructor(
    @Inject(REPOSITORY_REPOSITORY)
    private readonly repositoryRepository: IRepositoryRepository,
    @Inject(GIT_SERVICE)
    private readonly gitService: IGitService,
  ) {}

  async execute(command: CloneRepositoryCommand): Promise<Repository> {
    const { repositoryUrl: urlString, entrypoint } = command;

    this.logger.log(`Cloning repository: ${urlString}`);

    // Create value object
    const repositoryUrl = RepositoryUrl.create(urlString);

    // Check if repository already exists
    let repository = await this.repositoryRepository.findByUrl(repositoryUrl);

    if (!repository) {
      // Create new repository aggregate
      repository = Repository.create(repositoryUrl, entrypoint);
    }

    // If already cloned, return it
    if (repository.isCloned()) {
      this.logger.log(
        `Repository already cloned at: ${repository.localPath}`,
      );
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
