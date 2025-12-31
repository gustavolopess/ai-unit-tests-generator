import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { INpmService } from '@/bounded-contexts/job-processing/domain/services/npm-service.interface';

const execAsync = promisify(exec);

@Injectable()
export class NpmService implements INpmService {
  private readonly logger = new Logger(NpmService.name);

  async install(
    workingDir: string,
    timeout: number = 300000,
  ): Promise<{ stdout: string; stderr: string }> {
    this.logger.log(`Running npm install in ${workingDir}`);

    try {
      const result = await execAsync('npm install', {
        cwd: workingDir,
        timeout,
      });

      if (result.stdout) {
        this.logger.log(`npm install stdout: ${result.stdout}`);
      }
      if (result.stderr) {
        this.logger.warn(`npm install stderr: ${result.stderr}`);
      }

      return result;
    } catch (error) {
      this.logger.error(`npm install failed: ${error.message}`);
      throw error;
    }
  }
}
