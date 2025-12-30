import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { IGitService } from '../domain/services/git-service.interface';

const execAsync = promisify(exec);

@Injectable()
export class GitService implements IGitService {
  private readonly logger = new Logger(GitService.name);

  async clone(repoUrl: string): Promise<string> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-'));

    try {
      this.logger.log(`Cloning repository ${repoUrl} to ${tmpDir}`);
      await execAsync(`git clone ${repoUrl} ${tmpDir}`);
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
      this.logger.log(`Ensuring repository is on main/master branch at ${repositoryPath}`);

      // First, fetch latest changes from remote
      await execAsync('git fetch origin', { cwd: repositoryPath });

      // Try to checkout main branch, if it doesn't exist try master
      try {
        await execAsync('git checkout main', { cwd: repositoryPath });
        this.logger.log(`Checked out main branch`);

        // Pull latest changes
        await execAsync('git pull origin main', { cwd: repositoryPath });
        this.logger.log(`Pulled latest changes from main branch`);
      } catch (error) {
        // If main doesn't exist, try master
        this.logger.log(`Main branch not found, trying master branch`);
        await execAsync('git checkout master', { cwd: repositoryPath });
        this.logger.log(`Checked out master branch`);

        // Pull latest changes
        await execAsync('git pull origin master', { cwd: repositoryPath });
        this.logger.log(`Pulled latest changes from master branch`);
      }
    } catch (error) {
      throw new Error(`Failed to ensure main/master branch and update: ${error.message}`);
    }
  }
}
