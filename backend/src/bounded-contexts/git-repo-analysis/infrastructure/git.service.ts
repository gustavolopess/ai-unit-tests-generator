import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { simpleGit, SimpleGit } from 'simple-git';
import { IGitService } from '@/bounded-contexts/git-repo-analysis/domain/services/git-service.interface';

@Injectable()
export class GitService implements IGitService {
  private readonly logger = new Logger(GitService.name);

  async clone(repoUrl: string): Promise<string> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-'));

    try {
      this.logger.log(`Cloning repository ${repoUrl} to ${tmpDir}`);

      // Validate URL format to prevent malicious inputs
      this.validateRepositoryUrl(repoUrl);

      const git: SimpleGit = simpleGit();
      await git.clone(repoUrl, tmpDir);

      this.logger.log(`Repository cloned successfully to ${tmpDir}`);
      return tmpDir;
    } catch (error) {
      await this.cleanup(tmpDir);
      throw new Error(`Failed to clone repository: ${error.message}`);
    }
  }

  async cleanup(dirPath: string): Promise<void> {
    // Cleanup is disabled for now to allow reuse of cloned repositories
    // try {
    //   this.logger.log(`Cleaning up directory ${dirPath}`);
    //   await fs.rm(dirPath, { recursive: true, force: true });
    //   this.logger.log(`Directory ${dirPath} cleaned up successfully`);
    // } catch (error) {
    //   this.logger.error(`Failed to cleanup directory ${dirPath}: ${error.message}`);
    // }
  }

  async ensureMainBranchAndUpdate(repositoryPath: string): Promise<void> {
    try {
      this.logger.log(
        `Ensuring repository is on main/master branch at ${repositoryPath}`,
      );

      const git: SimpleGit = simpleGit(repositoryPath);

      // First, fetch latest changes from remote
      await git.fetch('origin');

      // Try to checkout main branch, if it doesn't exist try master
      try {
        await git.checkout('main');
        this.logger.log(`Checked out main branch`);

        // Pull latest changes
        await git.pull('origin', 'main');
        this.logger.log(`Pulled latest changes from main branch`);
      } catch (error) {
        // If main doesn't exist, try master
        this.logger.log(`Main branch not found, trying master branch`);
        await git.checkout('master');
        this.logger.log(`Checked out master branch`);

        // Pull latest changes
        await git.pull('origin', 'master');
        this.logger.log(`Pulled latest changes from master branch`);
      }
    } catch (error) {
      throw new Error(
        `Failed to ensure main/master branch and update: ${error.message}`,
      );
    }
  }

  /**
   * Validates a repository URL to ensure it's safe to use
   * Prevents command injection by validating URL format
   */
  private validateRepositoryUrl(url: string): void {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      throw new Error('Repository URL cannot be empty');
    }

    // Check for dangerous characters that could enable command injection
    const dangerousChars = /[`$();|&<>]/;
    if (dangerousChars.test(trimmedUrl)) {
      throw new Error('Repository URL contains invalid characters');
    }

    // Validate URL format - allow HTTPS and SSH formats
    const httpsPattern = /^https:\/\/[a-zA-Z0-9.-]+\/[a-zA-Z0-9._/-]+\.git$/;
    const sshPattern = /^git@[a-zA-Z0-9.-]+:[a-zA-Z0-9._/-]+\.git$/;
    const httpsWithoutGit = /^https:\/\/[a-zA-Z0-9.-]+\/[a-zA-Z0-9._/-]+$/;

    if (
      !httpsPattern.test(trimmedUrl) &&
      !sshPattern.test(trimmedUrl) &&
      !httpsWithoutGit.test(trimmedUrl)
    ) {
      throw new Error(
        'Invalid repository URL format. Must be HTTPS (https://...) or SSH (git@...) format',
      );
    }
  }
}
