import { GitRepoUrl } from './git-repo-url.value-object';

describe('GitRepoUrl Value Object', () => {
  describe('create', () => {
    it('should create a valid repository URL', () => {
      const url = GitRepoUrl.create('https://github.com/user/repo.git');
      expect(url.getValue()).toBe('https://github.com/user/repo.git');
    });

    it('should accept URL without .git suffix', () => {
      const url = GitRepoUrl.create('https://github.com/user/repo');
      expect(url.getValue()).toBe('https://github.com/user/repo');
    });

    it('should accept URL with www prefix', () => {
      const url = GitRepoUrl.create('https://www.github.com/user/repo');
      expect(url.getValue()).toBe('https://www.github.com/user/repo');
    });

    it('should accept http URLs', () => {
      const url = GitRepoUrl.create('http://github.com/user/repo');
      expect(url.getValue()).toBe('http://github.com/user/repo');
    });

    it('should throw error for empty string', () => {
      expect(() => GitRepoUrl.create('')).toThrow(
        'Git repository URL cannot be empty',
      );
    });

    it('should throw error for whitespace-only string', () => {
      expect(() => GitRepoUrl.create('   ')).toThrow(
        'Git repository URL cannot be empty',
      );
    });

    it('should throw error for non-GitHub URL', () => {
      expect(() => GitRepoUrl.create('https://gitlab.com/user/repo')).toThrow(
        'Invalid GitHub repository URL',
      );
    });

    it('should throw error for invalid URL format', () => {
      expect(() => GitRepoUrl.create('not-a-url')).toThrow(
        'Invalid GitHub repository URL',
      );
    });

    it('should throw error for GitHub URL without repo path', () => {
      expect(() => GitRepoUrl.create('https://github.com/user')).toThrow(
        'Invalid GitHub repository URL',
      );
    });
  });

  describe('getValue', () => {
    it('should return the original URL value', () => {
      const originalUrl = 'https://github.com/org/project.git';
      const url = GitRepoUrl.create(originalUrl);
      expect(url.getValue()).toBe(originalUrl);
    });
  });

  describe('getNormalized', () => {
    it('should remove .git suffix', () => {
      const url = GitRepoUrl.create('https://github.com/user/repo.git');
      expect(url.getNormalized()).toBe('https://github.com/user/repo');
    });

    it('should convert to lowercase', () => {
      const url = GitRepoUrl.create('https://github.com/User/Repo');
      expect(url.getNormalized()).toBe('https://github.com/user/repo');
    });

    it('should handle URL already without .git', () => {
      const url = GitRepoUrl.create('https://github.com/user/repo');
      expect(url.getNormalized()).toBe('https://github.com/user/repo');
    });
  });

  describe('equality', () => {
    it('should be equal when URLs are the same', () => {
      const url1 = GitRepoUrl.create('https://github.com/user/repo.git');
      const url2 = GitRepoUrl.create('https://github.com/user/repo.git');

      expect(url1.equals(url2)).toBe(true);
    });

    it('should not be equal when URLs are different', () => {
      const url1 = GitRepoUrl.create('https://github.com/user/repo1.git');
      const url2 = GitRepoUrl.create('https://github.com/user/repo2.git');

      expect(url1.equals(url2)).toBe(false);
    });
  });
});
