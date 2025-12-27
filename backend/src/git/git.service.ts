import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

@Injectable()
export class GitService {
  private readonly logger = new Logger(GitService.name);

  async cloneRepository(repoUrl: string): Promise<string> {
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
    // try {
    //   this.logger.log(`Cleaning up directory ${dirPath}`);
    //   await fs.rm(dirPath, { recursive: true, force: true });
    //   this.logger.log(`Directory ${dirPath} cleaned up successfully`);
    // } catch (error) {
    //   this.logger.error(`Failed to cleanup directory ${dirPath}: ${error.message}`);
    // }
  }
}
