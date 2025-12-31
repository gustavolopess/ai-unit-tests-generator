import { Test, TestingModule } from '@nestjs/testing';
import { CloneRepositoryHandler } from './clone-repository.handler';
import { CloneRepositoryCommand } from './clone-repository.command';
import { GIT_REPO_REPOSITORY } from '@/bounded-contexts/git-repo-analysis/domain/repositories/git-repo.repository.interface';
import { GIT_SERVICE } from '@/bounded-contexts/git-repo-analysis/domain/services/git-service.interface';
import { GitRepo } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo.entity';
import { GitRepoUrl } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo-url.value-object';

describe('CloneRepositoryHandler', () => {
  let handler: CloneRepositoryHandler;
  let repositoryRepository: any;
  let gitService: any;

  const urlStr = 'https://github.com/user/repo.git';
  const localPath = '/tmp/repo';

  beforeEach(async () => {
    repositoryRepository = {
      findByUrl: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };

    gitService = {
      clone: jest.fn().mockResolvedValue(localPath),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloneRepositoryHandler,
        {
          provide: GIT_REPO_REPOSITORY,
          useValue: repositoryRepository,
        },
        {
          provide: GIT_SERVICE,
          useValue: gitService,
        },
      ],
    }).compile();

    handler = module.get<CloneRepositoryHandler>(CloneRepositoryHandler);
  });

  it('should clone a new repository', async () => {
    // Repo not found
    repositoryRepository.findByUrl.mockResolvedValue(null);

    const command = new CloneRepositoryCommand(urlStr);
    const repo = await handler.execute(command);

    // Verify git clone was called
    expect(gitService.clone).toHaveBeenCalledWith(urlStr);

    // Verify repository state
    expect(repo).toBeInstanceOf(GitRepo);
    expect(repo.url.getValue()).toBe(urlStr);
    expect(repo.localPath).toBe(localPath);
    expect(repo.isCloned()).toBe(true);

    // Verify save was called
    expect(repositoryRepository.save).toHaveBeenCalledWith(repo);

    // Verify findByUrl was called with correct value object
    expect(repositoryRepository.findByUrl).toHaveBeenCalled();
    const calledUrl = repositoryRepository.findByUrl.mock.calls[0][0];
    expect(calledUrl).toBeInstanceOf(GitRepoUrl);
    expect(calledUrl.getValue()).toBe(urlStr);
  });

  it('should clone a known but uncloned repository', async () => {
    // Repo found but not cloned
    const existingRepo = GitRepo.create(GitRepoUrl.create(urlStr));
    repositoryRepository.findByUrl.mockResolvedValue(existingRepo);

    const command = new CloneRepositoryCommand(urlStr);
    const repo = await handler.execute(command);

    expect(repo.id.getValue()).toBe(existingRepo.id.getValue());
    expect(gitService.clone).toHaveBeenCalledWith(urlStr);
    expect(repo.isCloned()).toBe(true);
    expect(repositoryRepository.save).toHaveBeenCalledWith(repo);
  });

  it('should return existing repository if already cloned', async () => {
    // Repo found and already cloned
    const existingRepo = GitRepo.create(GitRepoUrl.create(urlStr));
    existingRepo.markAsCloned(localPath);
    repositoryRepository.findByUrl.mockResolvedValue(existingRepo);

    const command = new CloneRepositoryCommand(urlStr);
    const repo = await handler.execute(command);

    // Should NOT clone again
    expect(gitService.clone).not.toHaveBeenCalled();

    // Should return existing without saving
    expect(repo.isCloned()).toBe(true);
    expect(repositoryRepository.save).not.toHaveBeenCalled();
  });
});
