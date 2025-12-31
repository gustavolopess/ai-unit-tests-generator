import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { AnalyzeCoverageCommand } from './analyze-coverage.command';
import { GitRepo } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo.entity';
import { GitRepoId } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo-id.value-object';
import type { IGitRepoRepository } from '@/bounded-contexts/git-repo-analysis/domain/repositories/git-repo.repository.interface';
import { GIT_REPO_REPOSITORY } from '@/bounded-contexts/git-repo-analysis/domain/repositories/git-repo.repository.interface';
import type { ICoverageAnalyzer } from '@/bounded-contexts/git-repo-analysis/domain/services/coverage-analyzer.interface';
import { COVERAGE_ANALYZER } from '@/bounded-contexts/git-repo-analysis/domain/services/coverage-analyzer.interface';
import type { IGitService } from '@/bounded-contexts/git-repo-analysis/domain/services/git-service.interface';
import { GIT_SERVICE } from '@/bounded-contexts/git-repo-analysis/domain/services/git-service.interface';

@CommandHandler(AnalyzeCoverageCommand)
export class AnalyzeCoverageHandler implements ICommandHandler<AnalyzeCoverageCommand> {
  private readonly logger = new Logger(AnalyzeCoverageHandler.name);

  constructor(
    @Inject(GIT_REPO_REPOSITORY)
    private readonly repositoryRepository: IGitRepoRepository,
    @Inject(COVERAGE_ANALYZER)
    private readonly coverageAnalyzer: ICoverageAnalyzer,
    @Inject(GIT_SERVICE)
    private readonly gitService: IGitService,
  ) {}

  async execute(command: AnalyzeCoverageCommand): Promise<GitRepo> {
    const { repositoryId: idString, entrypoint, onOutput } = command;

    this.logger.log(
      `Analyzing coverage for repository: ${idString}${entrypoint ? ` (entrypoint: ${entrypoint})` : ''}`,
    );

    // Get repository
    const repositoryId = GitRepoId.create(idString);
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
