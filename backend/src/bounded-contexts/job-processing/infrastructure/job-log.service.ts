import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { AppConfig } from '@/shared/config/app.config';

@Injectable()
export class JobLogService {
  private readonly logger = new Logger(JobLogService.name);
  private readonly logsDir: string;

  constructor() {
    this.logsDir = AppConfig.jobs.logsDir;
    this.ensureLogsDirExists();
  }

  private async ensureLogsDirExists(): Promise<void> {
    try {
      await fs.mkdir(this.logsDir, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create logs directory: ${error.message}`);
    }
  }

  /**
   * Get the log file path for a job
   */
  getLogPath(jobId: string): string {
    return join(this.logsDir, `${jobId}.log`);
  }

  /**
   * Append a line to the job's log file
   */
  async appendLog(jobId: string, message: string): Promise<void> {
    const logPath = this.getLogPath(jobId);
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}\n`;

    try {
      await fs.appendFile(logPath, logLine, 'utf-8');
    } catch (error) {
      this.logger.error(
        `Failed to write to log file ${logPath}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Read all log lines for a job
   */
  async readLogs(jobId: string): Promise<string[]> {
    const logPath = this.getLogPath(jobId);

    try {
      const content = await fs.readFile(logPath, 'utf-8');
      return content
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => {
          // Remove timestamp prefix for cleaner output
          const match = line.match(/\[.*?\] (.*)/);
          return match ? match[1] : line;
        });
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Log file doesn't exist yet
        return [];
      }
      this.logger.error(`Failed to read log file ${logPath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if a log file exists
   */
  async logExists(jobId: string): Promise<boolean> {
    const logPath = this.getLogPath(jobId);
    try {
      await fs.access(logPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a job's log file
   */
  async deleteLog(jobId: string): Promise<void> {
    const logPath = this.getLogPath(jobId);
    try {
      await fs.unlink(logPath);
      this.logger.log(`Deleted log file: ${logPath}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error(
          `Failed to delete log file ${logPath}: ${error.message}`,
        );
      }
    }
  }
}
