import { Test, TestingModule } from '@nestjs/testing';
import { AnalyzeCoverageHandler } from './analyze-coverage.handler';
import { AnalyzeCoverageCommand } from './analyze-coverage.command';
import { GIT_REPO_REPOSITORY } from '@/bounded-contexts/git-repo-analysis/domain/repositories/git-repo.repository.interface';
import { COVERAGE_ANALYZER } from '@/bounded-contexts/git-repo-analysis/domain/services/coverage-analyzer.interface';
import { GIT_SERVICE } from '@/bounded-contexts/git-repo-analysis/domain/services/git-service.interface';
import { GitRepo } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo.entity';
import { GitRepoUrl } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo-url.value-object';
import { FileCoverage } from '@/bounded-contexts/git-repo-analysis/domain/models/file-coverage.entity';
import { NotFoundException } from '@nestjs/common';

describe('AnalyzeCoverageHandler', () => {
  let handler: AnalyzeCoverageHandler;
  let repositoryRepository: any;
  let coverageAnalyzer: any;
  let gitService: any;

  const repoIdStr = 'repo-123';
  const localPath = '/tmp/repo';

  beforeEach(async () => {
    repositoryRepository = {
      findById: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };

    coverageAnalyzer = {
      analyze: jest.fn(),
    };

    gitService = {
      ensureMainBranchAndUpdate: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyzeCoverageHandler,
        {
          provide: GIT_REPO_REPOSITORY,
          useValue: repositoryRepository,
        },
        {
          provide: COVERAGE_ANALYZER,
          useValue: coverageAnalyzer,
        },
        {
          provide: GIT_SERVICE,
          useValue: gitService,
        },
      ],
    }).compile();

    handler = module.get<AnalyzeCoverageHandler>(AnalyzeCoverageHandler);
  });

  it('should analyze coverage successfully', async () => {
    // Setup existing cloned repo
    const repo = GitRepo.create(
      GitRepoUrl.create('https://github.com/a/b.git'),
    );
    // Force ID to match test
    Object.defineProperty(repo, 'id', {
      value: { getValue: () => repoIdStr },
    });
    repo.markAsCloned(localPath);

    repositoryRepository.findById.mockResolvedValue(repo);
    const mockCoverages = [FileCoverage.create('src/a.ts', 80)];
    coverageAnalyzer.analyze.mockResolvedValue(mockCoverages);

    const command = new AnalyzeCoverageCommand(repoIdStr);
    await handler.execute(command);

    // Verify git update
    expect(gitService.ensureMainBranchAndUpdate).toHaveBeenCalledWith(
      localPath,
    );

    // Verify analysis
    expect(coverageAnalyzer.analyze).toHaveBeenCalledWith(localPath, undefined);

    // Verify repo state updated
    expect(repo.fileCoverages).toHaveLength(1);
    expect(repo.lastAnalyzedAt).toBeInstanceOf(Date);

    // Verify save
    expect(repositoryRepository.save).toHaveBeenCalledWith(repo);
  });

  it('should throw NotFoundException if repo not found', async () => {
    repositoryRepository.findById.mockResolvedValue(null);

    const command = new AnalyzeCoverageCommand(repoIdStr);

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
  });

  it('should throw Error if repo not cloned', async () => {
    const repo = GitRepo.create(
      GitRepoUrl.create('https://github.com/a/b.git'),
    );
    repositoryRepository.findById.mockResolvedValue(repo);

    const command = new AnalyzeCoverageCommand(repoIdStr);

    await expect(handler.execute(command)).rejects.toThrow(
      'Repository must be cloned before analyzing coverage',
    );
  });

  it('should pass entrypoint to analyzer', async () => {
    const repo = GitRepo.create(
      GitRepoUrl.create('https://github.com/a/b.git'),
    );
    repo.markAsCloned(localPath);
    repositoryRepository.findById.mockResolvedValue(repo);
    coverageAnalyzer.analyze.mockResolvedValue([]);

    const command = new AnalyzeCoverageCommand(repoIdStr, 'packages/api');
    await handler.execute(command);

    // Should use subdirectory
    expect(coverageAnalyzer.analyze).toHaveBeenCalledWith(
      `${localPath}/packages/api`,
      undefined,
    );
  });
});
