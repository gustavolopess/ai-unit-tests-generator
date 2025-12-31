import { GitRepo, GitRepoProps } from './git-repo.entity';
import { GitRepoId } from './git-repo-id.value-object';
import { GitRepoUrl } from './git-repo-url.value-object';
import { FileCoverage } from './file-coverage.entity';
import { GitRepoClonedEvent } from '@/bounded-contexts/git-repo-analysis/domain/events/git-repo-cloned.event';
import { CoverageAnalysisCompletedEvent } from '@/bounded-contexts/git-repo-analysis/domain/events/coverage-analysis-completed.event';

describe('Repository Entity', () => {
  const createUrl = () => GitRepoUrl.create('https://github.com/user/repo.git');

  describe('create', () => {
    it('should create a new repository with empty file coverages', () => {
      const url = createUrl();
      const gitRepo = GitRepo.create(url);

      expect(gitRepo.url).toBe(url);
      expect(gitRepo.fileCoverages).toEqual([]);
      expect(gitRepo.localPath).toBeUndefined();
      expect(gitRepo.clonedAt).toBeUndefined();
      expect(gitRepo.lastAnalyzedAt).toBeUndefined();
    });

    it('should generate a unique ID', () => {
      const url = createUrl();
      const repo1 = GitRepo.create(url);
      const repo2 = GitRepo.create(url);

      expect(repo1.id.getValue()).not.toBe(repo2.id.getValue());
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute a repository from props without emitting events', () => {
      const id = GitRepoId.generate();
      const url = createUrl();
      const props: GitRepoProps = {
        url,
        localPath: '/tmp/repo',
        clonedAt: new Date('2024-01-01'),
        fileCoverages: [],
        lastAnalyzedAt: new Date('2024-01-02'),
      };

      const gitRepo = GitRepo.reconstitute(id, props);

      expect(gitRepo.id).toBe(id);
      expect(gitRepo.localPath).toBe('/tmp/repo');
      expect(gitRepo.domainEvents).toHaveLength(0);
    });
  });

  describe('markAsCloned', () => {
    it('should set localPath and clonedAt', () => {
      const gitRepo = GitRepo.create(createUrl());
      const localPath = '/tmp/cloned-repo';

      gitRepo.markAsCloned(localPath);

      expect(gitRepo.localPath).toBe(localPath);
      expect(gitRepo.clonedAt).toBeInstanceOf(Date);
    });

    it('should emit GitRepoClonedEvent', () => {
      const gitRepo = GitRepo.create(createUrl());

      gitRepo.markAsCloned('/tmp/repo');

      expect(gitRepo.domainEvents).toHaveLength(1);
      expect(gitRepo.domainEvents[0]).toBeInstanceOf(GitRepoClonedEvent);
    });

    it('should throw error if already cloned', () => {
      const gitRepo = GitRepo.create(createUrl());
      gitRepo.markAsCloned('/tmp/repo');

      expect(() => gitRepo.markAsCloned('/tmp/another')).toThrow(
        'GitRepo is already cloned',
      );
    });
  });

  describe('setCoverageResults', () => {
    it('should set file coverages and lastAnalyzedAt', () => {
      const gitRepo = GitRepo.create(createUrl());
      const fileCoverages = [
        FileCoverage.create('src/a.ts', 80),
        FileCoverage.create('src/b.ts', 60),
      ];

      gitRepo.setCoverageResults(fileCoverages);

      expect(gitRepo.fileCoverages).toHaveLength(2);
      expect(gitRepo.lastAnalyzedAt).toBeInstanceOf(Date);
    });

    it('should emit CoverageAnalysisCompletedEvent', () => {
      const gitRepo = GitRepo.create(createUrl());
      const fileCoverages = [FileCoverage.create('src/a.ts', 80)];

      gitRepo.setCoverageResults(fileCoverages);

      expect(gitRepo.domainEvents).toHaveLength(1);
      expect(gitRepo.domainEvents[0]).toBeInstanceOf(
        CoverageAnalysisCompletedEvent,
      );
    });

    it('should replace existing file coverages', () => {
      const gitRepo = GitRepo.create(createUrl());

      gitRepo.setCoverageResults([FileCoverage.create('src/a.ts', 80)]);
      gitRepo.setCoverageResults([
        FileCoverage.create('src/b.ts', 90),
        FileCoverage.create('src/c.ts', 70),
      ]);

      expect(gitRepo.fileCoverages).toHaveLength(2);
      expect(gitRepo.fileCoverages[0].filePath).toBe('src/b.ts');
    });
  });

  describe('isCloned', () => {
    it('should return false if not cloned', () => {
      const gitRepo = GitRepo.create(createUrl());
      expect(gitRepo.isCloned()).toBe(false);
    });

    it('should return true if cloned', () => {
      const gitRepo = GitRepo.create(createUrl());
      gitRepo.markAsCloned('/tmp/repo');
      expect(gitRepo.isCloned()).toBe(true);
    });
  });

  describe('hasBeenAnalyzed', () => {
    it('should return false if no file coverages', () => {
      const gitRepo = GitRepo.create(createUrl());
      expect(gitRepo.hasBeenAnalyzed()).toBe(false);
    });

    it('should return true if has file coverages', () => {
      const gitRepo = GitRepo.create(createUrl());
      gitRepo.setCoverageResults([FileCoverage.create('src/a.ts', 80)]);
      expect(gitRepo.hasBeenAnalyzed()).toBe(true);
    });
  });

  describe('calculateAverageCoverage', () => {
    it('should return 0 if no file coverages', () => {
      const gitRepo = GitRepo.create(createUrl());
      expect(gitRepo.calculateAverageCoverage()).toBe(0);
    });

    it('should calculate average correctly', () => {
      const gitRepo = GitRepo.create(createUrl());
      gitRepo.setCoverageResults([
        FileCoverage.create('src/a.ts', 80),
        FileCoverage.create('src/b.ts', 60),
        FileCoverage.create('src/c.ts', 100),
      ]);

      expect(gitRepo.calculateAverageCoverage()).toBe(80);
    });

    it('should round to 2 decimal places', () => {
      const gitRepo = GitRepo.create(createUrl());
      gitRepo.setCoverageResults([
        FileCoverage.create('src/a.ts', 33),
        FileCoverage.create('src/b.ts', 33),
        FileCoverage.create('src/c.ts', 34),
      ]);

      expect(gitRepo.calculateAverageCoverage()).toBe(33.33);
    });
  });

  describe('getFilesWithLowCoverage', () => {
    it('should return empty array if no files below threshold', () => {
      const gitRepo = GitRepo.create(createUrl());
      gitRepo.setCoverageResults([
        FileCoverage.create('src/a.ts', 85),
        FileCoverage.create('src/b.ts', 90),
      ]);

      expect(gitRepo.getFilesWithLowCoverage(80)).toHaveLength(0);
    });

    it('should return files below threshold', () => {
      const gitRepo = GitRepo.create(createUrl());
      gitRepo.setCoverageResults([
        FileCoverage.create('src/a.ts', 85),
        FileCoverage.create('src/b.ts', 60),
        FileCoverage.create('src/c.ts', 75),
      ]);

      const lowCoverageFiles = gitRepo.getFilesWithLowCoverage(80);

      expect(lowCoverageFiles).toHaveLength(2);
      expect(lowCoverageFiles.map((f) => f.filePath)).toContain('src/b.ts');
      expect(lowCoverageFiles.map((f) => f.filePath)).toContain('src/c.ts');
    });

    it('should use default threshold of 80', () => {
      const gitRepo = GitRepo.create(createUrl());
      gitRepo.setCoverageResults([
        FileCoverage.create('src/a.ts', 79),
        FileCoverage.create('src/b.ts', 80),
      ]);

      const lowCoverageFiles = gitRepo.getFilesWithLowCoverage();
      expect(lowCoverageFiles).toHaveLength(1);
    });
  });

  describe('getWorkingDirectory', () => {
    it('should return localPath if no entrypoint', () => {
      const gitRepo = GitRepo.create(createUrl());
      gitRepo.markAsCloned('/tmp/repo');

      expect(gitRepo.getWorkingDirectory()).toBe('/tmp/repo');
    });

    it('should return localPath + entrypoint if entrypoint provided', () => {
      const gitRepo = GitRepo.create(createUrl());
      gitRepo.markAsCloned('/tmp/repo');

      expect(gitRepo.getWorkingDirectory('packages/api')).toBe(
        '/tmp/repo/packages/api',
      );
    });

    it('should throw error if not cloned', () => {
      const gitRepo = GitRepo.create(createUrl());

      expect(() => gitRepo.getWorkingDirectory()).toThrow(
        'GitRepo has not been cloned yet',
      );
    });
  });

  describe('fileCoverages getter returns copy', () => {
    it('should return a copy of fileCoverages array', () => {
      const gitRepo = GitRepo.create(createUrl());
      gitRepo.setCoverageResults([FileCoverage.create('src/a.ts', 80)]);

      const coverages = gitRepo.fileCoverages;
      coverages.push(FileCoverage.create('src/b.ts', 90));

      // Original should not be modified
      expect(gitRepo.fileCoverages).toHaveLength(1);
    });
  });
});
