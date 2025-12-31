import { Injectable, Logger } from '@nestjs/common';
import { claude } from '@instantlyeasy/claude-code-sdk-ts';
import { ICoverageAnalyzer } from '@/bounded-contexts/git-repo-analysis/domain/services/coverage-analyzer.interface';
import { FileCoverage } from '@/bounded-contexts/git-repo-analysis/domain/models/file-coverage.entity';

interface ClaudeFileCoverage {
  file: string;
  coverage: number;
}

@Injectable()
export class ClaudeCoverageAnalyzerService implements ICoverageAnalyzer {
  private readonly logger = new Logger(ClaudeCoverageAnalyzerService.name);

  async analyze(
    workingDirectory: string,
    onOutput?: (output: string) => void,
  ): Promise<FileCoverage[]> {
    const prompt = this.buildAnalysisPrompt();

    try {
      this.logger.log(`Starting coverage analysis in ${workingDirectory}`);

      if (onOutput) {
        onOutput('Starting Claude CLI analysis...');
      }

      const result = await claude()
        .inDirectory(workingDirectory)
        .skipPermissions()
        .onMessage((msg) => {
          const msgStr = JSON.stringify(msg);
          this.logger.log(`[Claude message] ${msgStr}`);
          if (onOutput) {
            onOutput(`[Claude] ${msgStr}`);
          }
        })
        .query(prompt)
        .asJSON<ClaudeFileCoverage[]>();

      if (!result) {
        this.logger.warn(
          'Claude returned null result, returning empty coverage',
        );
        if (onOutput) {
          onOutput('Analysis completed with no results');
        }
        return [];
      }

      this.logger.log(`Analysis completed with ${result.length} files`);

      if (onOutput) {
        onOutput(`Analysis completed with ${result.length} files`);
      }

      // Convert to FileCoverage entities
      return result.map((item) =>
        FileCoverage.create(item.file, item.coverage),
      );
    } catch (error) {
      this.logger.error(`Coverage analysis failed: ${error.message}`);
      if (onOutput) {
        onOutput(`ERROR: ${error.message}`);
      }
      throw new Error(`Failed to analyze coverage: ${error.message}`);
    }
  }

  private buildAnalysisPrompt(): string {
    return `
You are a code coverage analysis expert. Analyze this repository and provide coverage information for all important source files.

For each source file, estimate the test coverage percentage based on:
1. Presence of corresponding test files
2. Number of tests for the file
3. Coverage of different code paths and edge cases

Return a JSON array with the following structure:
[
  {
    "file": "path/to/file.ts",
    "coverage": 75.5
  }
]

Important:
- Only include actual source files (exclude test files, config files, etc.)
- Coverage should be a number between 0 and 100
- Be conservative in your estimates
- Focus on TypeScript/JavaScript files in src/ directories
`;
  }
}
