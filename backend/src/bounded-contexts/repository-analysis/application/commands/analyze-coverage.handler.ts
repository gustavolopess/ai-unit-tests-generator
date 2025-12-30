import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { AnalyzeCoverageCommand } from './analyze-coverage.command';
import { Repository } from '../../domain/models/repository.entity';
import { RepositoryId } from '../../domain/models/repository-id.value-object';
import type { IRepositoryRepository } from '../../domain/repositories/repository.repository.interface';
import { REPOSITORY_REPOSITORY } from '../../domain/repositories/repository.repository.interface';
import type { ICoverageAnalyzer } from '../../domain/services/coverage-analyzer.interface';
import { COVERAGE_ANALYZER } from '../../domain/services/coverage-analyzer.interface';
import type { IGitService } from '../../domain/services/git-service.interface';
import { GIT_SERVICE } from '../../domain/services/git-service.interface';

@CommandHandler(AnalyzeCoverageCommand)
export class AnalyzeCoverageHandler
  implements ICommandHandler<AnalyzeCoverageCommand>
{
  private readonly logger = new Logger(AnalyzeCoverageHandler.name);

  constructor(
    @Inject(REPOSITORY_REPOSITORY)
    private readonly repositoryRepository: IRepositoryRepository,
    @Inject(COVERAGE_ANALYZER)
    private readonly coverageAnalyzer: ICoverageAnalyzer,
    @Inject(GIT_SERVICE)
    private readonly gitService: IGitService,
  ) {}

  async execute(command: AnalyzeCoverageCommand): Promise<Repository> {
    const { repositoryId: idString, entrypoint, onOutput } = command;

    this.logger.log(`Analyzing coverage for repository: ${idString}${entrypoint ? ` (entrypoint: ${entrypoint})` : ''}`);

    // Get repository
    const repositoryId = RepositoryId.create(idString);
    const repository = await this.repositoryRepository.findById(repositoryId);

    if (!repository) {
      throw new NotFoundException(`Repository ${idString} not found`);
    }

    if (!repository.isCloned()) {
      throw new Error('Repository must be cloned before analyzing coverage');
    }

    // Ensure we're on main/master branch and pull latest changes
    await this.gitService.ensureMainBranchAndUpdate(repository.localPath!);

    // Get working directory (pass entrypoint from command)
    const workingDirectory = repository.getWorkingDirectory(entrypoint);

    // Analyze coverage
    const fileCoverages = await this.coverageAnalyzer.analyze(
      workingDirectory,
      onOutput,
    );

    // Set coverage results (publishes CoverageAnalysisCompletedEvent)
    repository.setCoverageResults(fileCoverages);

    // Save to repository
    await this.repositoryRepository.save(repository);

    this.logger.log(
      `Coverage analysis completed: ${fileCoverages.length} files analyzed`,
    );

    return repository;
  }
}
