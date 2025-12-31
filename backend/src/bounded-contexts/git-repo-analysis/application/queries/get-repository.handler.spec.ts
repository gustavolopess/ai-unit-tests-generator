import { Test, TestingModule } from '@nestjs/testing';
import { GetRepositoryHandler } from './get-repository.handler';
import { GetRepositoryQuery } from './get-repository.query';
import { GIT_REPO_REPOSITORY } from '@/bounded-contexts/git-repo-analysis/domain/repositories/git-repo.repository.interface';
import { GitRepo } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo.entity';
import { GitRepoUrl } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo-url.value-object';
import { GitRepoId } from '@/bounded-contexts/git-repo-analysis/domain/models/git-repo-id.value-object';
import { NotFoundException } from '@nestjs/common';

describe('GetRepositoryHandler', () => {
  let handler: GetRepositoryHandler;
  let repositoryRepository: any;

  const repoIdStr = 'repo-123';
  const repoUrl = 'https://github.com/user/repo.git';

  beforeEach(async () => {
    repositoryRepository = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetRepositoryHandler,
        {
          provide: GIT_REPO_REPOSITORY,
          useValue: repositoryRepository,
        },
      ],
    }).compile();

    handler = module.get<GetRepositoryHandler>(GetRepositoryHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should retrieve repository successfully when it exists', async () => {
      // Arrange
      const repo = GitRepo.create(GitRepoUrl.create(repoUrl));
      // Force ID to match test
      Object.defineProperty(repo, 'id', {
        value: { getValue: () => repoIdStr },
      });
      repositoryRepository.findById.mockResolvedValue(repo);

      const query = new GetRepositoryQuery(repoIdStr);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result).toBe(repo);
      expect(result).toBeInstanceOf(GitRepo);
      expect(repositoryRepository.findById).toHaveBeenCalledTimes(1);
      expect(repositoryRepository.findById).toHaveBeenCalledWith(
        expect.any(GitRepoId),
      );

      // Verify the correct ID was used
      const calledId = repositoryRepository.findById.mock.calls[0][0];
      expect(calledId).toBeInstanceOf(GitRepoId);
      expect(calledId.getValue()).toBe(repoIdStr);
    });

    it('should throw NotFoundException when repository does not exist', async () => {
      // Arrange
      repositoryRepository.findById.mockResolvedValue(null);
      const query = new GetRepositoryQuery(repoIdStr);

      // Act & Assert
      await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
      await expect(handler.execute(query)).rejects.toThrow(
        `Repository ${repoIdStr} not found`,
      );

      expect(repositoryRepository.findById).toHaveBeenCalledWith(
        expect.any(GitRepoId),
      );
    });

    it('should throw NotFoundException when repository is undefined', async () => {
      // Arrange
      repositoryRepository.findById.mockResolvedValue(undefined);
      const query = new GetRepositoryQuery(repoIdStr);

      // Act & Assert
      await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
      expect(repositoryRepository.findById).toHaveBeenCalledTimes(1);
    });

    it('should retrieve a cloned repository', async () => {
      // Arrange
      const repo = GitRepo.create(GitRepoUrl.create(repoUrl));
      Object.defineProperty(repo, 'id', {
        value: { getValue: () => repoIdStr },
      });
      repo.markAsCloned('/tmp/repo');
      repositoryRepository.findById.mockResolvedValue(repo);

      const query = new GetRepositoryQuery(repoIdStr);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result).toBe(repo);
      expect(result.isCloned()).toBe(true);
      expect(result.localPath).toBe('/tmp/repo');
    });

    it('should retrieve an uncloned repository', async () => {
      // Arrange
      const repo = GitRepo.create(GitRepoUrl.create(repoUrl));
      Object.defineProperty(repo, 'id', {
        value: { getValue: () => repoIdStr },
      });
      repositoryRepository.findById.mockResolvedValue(repo);

      const query = new GetRepositoryQuery(repoIdStr);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result).toBe(repo);
      expect(result.isCloned()).toBe(false);
      expect(result.localPath).toBeUndefined();
    });

    it('should handle repository with file coverage data', async () => {
      // Arrange
      const repo = GitRepo.create(GitRepoUrl.create(repoUrl));
      Object.defineProperty(repo, 'id', {
        value: { getValue: () => repoIdStr },
      });
      repo.markAsCloned('/tmp/repo');
      repo.setCoverageResults([]);
      repositoryRepository.findById.mockResolvedValue(repo);

      const query = new GetRepositoryQuery(repoIdStr);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result).toBe(repo);
      expect(result.fileCoverages).toBeDefined();
      expect(result.lastAnalyzedAt).toBeInstanceOf(Date);
    });

    it('should handle different repository ID formats', async () => {
      // Arrange
      const uuidId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
      const repo = GitRepo.create(GitRepoUrl.create(repoUrl));
      Object.defineProperty(repo, 'id', {
        value: { getValue: () => uuidId },
      });
      repositoryRepository.findById.mockResolvedValue(repo);

      const query = new GetRepositoryQuery(uuidId);

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result).toBe(repo);
      const calledId = repositoryRepository.findById.mock.calls[0][0];
      expect(calledId.getValue()).toBe(uuidId);
    });

    it('should propagate errors from repository.findById', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      repositoryRepository.findById.mockRejectedValue(error);
      const query = new GetRepositoryQuery(repoIdStr);

      // Act & Assert
      await expect(handler.execute(query)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should handle empty string repository ID by throwing error from GitRepoId.create', async () => {
      // Arrange
      const query = new GetRepositoryQuery('');

      // Act & Assert
      // GitRepoId.create will throw an error for empty strings
      await expect(handler.execute(query)).rejects.toThrow(
        'GitRepoId cannot be empty',
      );
      expect(repositoryRepository.findById).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only repository ID by throwing error from GitRepoId.create', async () => {
      // Arrange
      const query = new GetRepositoryQuery('   ');

      // Act & Assert
      // GitRepoId.create will throw an error for whitespace-only strings
      await expect(handler.execute(query)).rejects.toThrow(
        'GitRepoId cannot be empty',
      );
      expect(repositoryRepository.findById).not.toHaveBeenCalled();
    });

    it('should create GitRepoId value object correctly', async () => {
      // Arrange
      const repo = GitRepo.create(GitRepoUrl.create(repoUrl));
      repositoryRepository.findById.mockResolvedValue(repo);
      const query = new GetRepositoryQuery(repoIdStr);

      // Act
      await handler.execute(query);

      // Assert
      const calledId = repositoryRepository.findById.mock.calls[0][0];
      expect(calledId).toBeInstanceOf(GitRepoId);
      expect(calledId.getValue()).toBe(repoIdStr);
    });
  });

  describe('edge cases', () => {
    it('should handle findById returning null exactly once', async () => {
      // Arrange
      repositoryRepository.findById.mockResolvedValueOnce(null);
      const query = new GetRepositoryQuery(repoIdStr);

      // Act & Assert
      await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
      expect(repositoryRepository.findById).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent queries for the same repository', async () => {
      // Arrange
      const repo = GitRepo.create(GitRepoUrl.create(repoUrl));
      Object.defineProperty(repo, 'id', {
        value: { getValue: () => repoIdStr },
      });
      repositoryRepository.findById.mockResolvedValue(repo);

      const query1 = new GetRepositoryQuery(repoIdStr);
      const query2 = new GetRepositoryQuery(repoIdStr);

      // Act
      const [result1, result2] = await Promise.all([
        handler.execute(query1),
        handler.execute(query2),
      ]);

      // Assert
      expect(result1).toBeInstanceOf(GitRepo);
      expect(result2).toBeInstanceOf(GitRepo);
      expect(repositoryRepository.findById).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent queries for different repositories', async () => {
      // Arrange
      const repo1 = GitRepo.create(GitRepoUrl.create(repoUrl));
      const repo2 = GitRepo.create(GitRepoUrl.create(repoUrl));
      Object.defineProperty(repo1, 'id', {
        value: { getValue: () => 'repo-1' },
      });
      Object.defineProperty(repo2, 'id', {
        value: { getValue: () => 'repo-2' },
      });

      repositoryRepository.findById.mockImplementation(async (id: GitRepoId) => {
        if (id.getValue() === 'repo-1') return repo1;
        if (id.getValue() === 'repo-2') return repo2;
        return null;
      });

      const query1 = new GetRepositoryQuery('repo-1');
      const query2 = new GetRepositoryQuery('repo-2');

      // Act
      const [result1, result2] = await Promise.all([
        handler.execute(query1),
        handler.execute(query2),
      ]);

      // Assert
      expect(result1).toBe(repo1);
      expect(result2).toBe(repo2);
      expect(repositoryRepository.findById).toHaveBeenCalledTimes(2);
    });
  });

  describe('integration with GitRepoId value object', () => {
    it('should use GitRepoId.create for ID validation', async () => {
      // Arrange
      const spy = jest.spyOn(GitRepoId, 'create');
      const repo = GitRepo.create(GitRepoUrl.create(repoUrl));
      repositoryRepository.findById.mockResolvedValue(repo);
      const query = new GetRepositoryQuery(repoIdStr);

      // Act
      await handler.execute(query);

      // Assert
      expect(spy).toHaveBeenCalledWith(repoIdStr);
      spy.mockRestore();
    });
  });
});
