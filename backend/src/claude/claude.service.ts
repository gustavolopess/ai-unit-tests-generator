import { Injectable, Logger } from '@nestjs/common';
import { claude } from '@instantlyeasy/claude-code-sdk-ts';

export interface FileCoverage {
  file: string;
  coverage: number;
}

@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);

  async analyzeCoverage(
    repoPath: string,
    onOutput?: (output: string) => void,
  ): Promise<FileCoverage[]> {
    const prompt = this.buildAnalysisPrompt();

    try {
      this.logger.log(`Starting Claude CLI analysis in ${repoPath}`);
      this.logger.log(`Prompt: ${prompt.substring(0, 100)}...`);

      if (onOutput) {
        onOutput('Starting Claude CLI analysis...');
      }

      const result = await claude()
        .inDirectory(repoPath)
        .skipPermissions()
        .onMessage((msg) => {
          const msgStr = JSON.stringify(msg);
          this.logger.log(`[Claude message] ${msgStr}`);
          if (onOutput) {
            onOutput(`[Claude] ${msgStr}`);
          }
        })
        .query(prompt)
        .asJSON<FileCoverage[]>();

      if (!result) {
        this.logger.warn('Claude returned null result, returning empty coverage');
        if (onOutput) {
          onOutput('Analysis completed with no results');
        }
        return [];
      }

      this.logger.log(`Claude analysis completed successfully`);
      this.logger.log(`Received ${result.length} file coverage entries`);

      if (onOutput) {
        onOutput(`Analysis completed with ${result.length} files`);
      }

      return result;
    } catch (error) {
      this.logger.error(`Claude CLI analysis failed: ${error.message}`);
      if (onOutput) {
        onOutput(`ERROR: ${error.message}`);
      }
      throw new Error(`Failed to analyze coverage: ${error.message}`);
    }
  }

  async generateTests(
    repoPath: string,
    filePath: string,
    onOutput?: (output: string) => void,
  ): Promise<{
    summary: string;
    testFilePath?: string;
    coverage?: number;
    sessionId?: string;
  }> {
    const prompt = this.buildTestGenerationPrompt(filePath);
    let summary = '';
    let sessionId: string | undefined;

    try {
      this.logger.log(`Generating tests for ${filePath} in ${repoPath}`);
      this.logger.log(`Prompt: ${prompt.substring(0, 100)}...`);

      if (onOutput) {
        onOutput(`Starting test generation for ${filePath}...`);
      }

      const result = await claude()
        .inDirectory(repoPath)
        .skipPermissions()
        .onMessage((msg) => {
          const msgStr = JSON.stringify(msg);
          this.logger.log(`[Claude message] ${msgStr}`);

          // Capture session ID
          if (msg.session_id && !sessionId) {
            sessionId = msg.session_id;
            this.logger.log(`[Session ID] ${sessionId}`);
          }

          // Capture text from assistant messages
          if (msg.type === 'assistant') {
            const textBlocks = msg.content.filter((block) => block.type === 'text');
            summary += textBlocks.map((block: any) => block.text).join('\n');
          }

          if (onOutput) {
            onOutput(`[Claude] ${msgStr}`);
          }
        })
        .query(prompt)
        .asText();

      if (!result && !summary) {
        this.logger.warn('Claude returned no text response for test generation');
        if (onOutput) {
          onOutput('Test generation completed with no summary');
        }
        return { summary: 'Test generation completed but no summary was provided' };
      }

      const finalSummary = result || summary;
      this.logger.log(`Test generation completed successfully`);
      this.logger.log(`Session ID: ${sessionId}`);

      if (onOutput) {
        onOutput(`Test generation completed`);
        if (sessionId) {
          onOutput(`Session ID: ${sessionId}`);
        }
      }

      return { summary: finalSummary, sessionId };
    } catch (error) {
      this.logger.error(`Test generation failed: ${error.message}`);
      if (onOutput) {
        onOutput(`ERROR: ${error.message}`);
      }
      throw new Error(`Failed to generate tests: ${error.message}`);
    }
  }

  async createPullRequest(
    repoPath: string,
    sessionId: string,
    onOutput?: (output: string) => void,
  ): Promise<{ prUrl: string; prNumber: number; summary: string }> {
    const prompt = this.buildPRCreationPrompt();
    let prUrl = '';
    let prNumber = 0;
    let summary = '';

    try {
      this.logger.log(`Creating PR using session ${sessionId} in ${repoPath}`);

      if (onOutput) {
        onOutput(`Creating pull request...`);
        onOutput(`Using session ID: ${sessionId}`);
      }

      const result = await claude()
        .inDirectory(repoPath)
        .skipPermissions()
        .withSessionId(sessionId)
        .onMessage((msg) => {
          const msgStr = JSON.stringify(msg);
          this.logger.log(`[Claude message] ${msgStr}`);

          // Capture text from assistant messages
          if (msg.type === 'assistant') {
            const textBlocks = msg.content.filter((block) => block.type === 'text');
            const text = textBlocks.map((block: any) => block.text).join('\n');
            summary += text;

            // Try to extract PR URL from text
            const urlMatch = text.match(/https:\/\/github\.com\/[^\s]+\/pull\/(\d+)/);
            if (urlMatch) {
              prUrl = urlMatch[0];
              prNumber = parseInt(urlMatch[1], 10);
              this.logger.log(`Found PR URL: ${prUrl}`);
            }
          }

          if (onOutput) {
            onOutput(`[Claude] ${msgStr}`);
          }
        })
        .query(prompt)
        .asText();

      if (!prUrl) {
        // Try to extract from final result
        const urlMatch = (result || summary).match(/https:\/\/github\.com\/[^\s]+\/pull\/(\d+)/);
        if (urlMatch) {
          prUrl = urlMatch[0];
          prNumber = parseInt(urlMatch[1], 10);
        }
      }

      if (!prUrl) {
        throw new Error('Failed to extract PR URL from Claude response');
      }

      this.logger.log(`PR created successfully: ${prUrl}`);

      if (onOutput) {
        onOutput(`PR created: ${prUrl}`);
      }

      return {
        prUrl,
        prNumber,
        summary: result || summary,
      };
    } catch (error) {
      this.logger.error(`PR creation failed: ${error.message}`);
      if (onOutput) {
        onOutput(`ERROR: ${error.message}`);
      }
      throw new Error(`Failed to create PR: ${error.message}`);
    }
  }

  private buildPRCreationPrompt(): string {
    return `Create a GitHub pull request with all the changes from this session.

IMPORTANT: Follow these steps exactly:

1. Run 'git status' to see all changes that were made
2. Review the changes to understand what was done (tests created, files modified, packages installed, etc.)
3. Create a comprehensive PR description that includes:
   - Summary of what was done
   - List of test files created
   - List of files that now have test coverage
   - Any new packages/dependencies that were installed
   - Test results (if tests were run)
   - Coverage improvements
4. Use the GitHub MCP to create a pull request with:
   - A clear, descriptive title (e.g., "Add unit tests for [filename]")
   - The comprehensive description you created
   - Ensure the PR is created against the main/master branch

IMPORTANT: After creating the PR, return the PR URL in your response. Make sure to include the full GitHub URL in format: https://github.com/owner/repo/pull/NUMBER

Example response format:
"Created pull request: https://github.com/owner/repo/pull/123

Summary: Added comprehensive unit tests for src/utils/helpers.ts
- Created test file: src/utils/helpers.spec.ts
- Added 15 test cases covering all functions
- Coverage improved from 42% to 87%
- All tests passing"`;
  }

  private buildTestGenerationPrompt(filePath: string): string {
    return `Generate comprehensive unit tests for the file: ${filePath}

IMPORTANT: Follow these steps exactly:

1. Read the file at ${filePath} to understand its implementation
2. Identify the testing framework being used in the repository (Jest, Vitest, etc.) by checking package.json and existing test files
3. Analyze all exported functions, classes, and methods in the file
4. For each function/method/class:
   - Write tests for happy path scenarios
   - Write tests for edge cases and error conditions
   - Write tests for boundary conditions
   - Mock external dependencies appropriately
5. Create a test file following the repository's naming convention:
   - Look for existing test files to determine the pattern (e.g., .test.ts, .spec.ts, __tests__/)
   - Place the test file in the appropriate location following the repository's structure
6. Ensure the tests:
   - Have clear, descriptive test names
   - Follow AAA pattern (Arrange, Act, Assert)
   - Cover all code paths to maximize coverage
   - Use appropriate matchers and assertions
   - Mock dependencies properly (e.g., API calls, database queries, file system)
7. Run the tests to verify they work
8. Run coverage for this specific file to verify improved coverage

Output requirements:
- Create the test file in the appropriate location
- Ensure all tests pass
- Report the new coverage percentage for the file
- Return a summary of:
  - Test file path created
  - Number of tests written
  - New coverage percentage
  - Any issues encountered

Focus on writing high-quality, maintainable tests that actually test the business logic, not just trivial tests to inflate coverage numbers.`;
  }

  private buildAnalysisPrompt(): string {
    return `Analyze this TypeScript repository and determine test coverage for each file.

IMPORTANT: Follow these steps exactly:

1. Read the package.json file to find the test command
2. Check if there's a jest.config file or jest configuration in package.json
3. Run the test command with coverage enabled:
   - If the test script is "jest", run: npm test -- --coverage
   - If the test script is "npm run test", add coverage flag if not already present
   - Look for coverage output in the terminal or in coverage/coverage-summary.json
4. Parse the coverage data to extract coverage percentage per file
5. If no tests exist, return 0% coverage for each .ts/.tsx/.js/.jsx file in the src directory

Coverage data sources (in order of preference):
- coverage/coverage-summary.json (most reliable)
- Terminal output table from jest/vitest
- lcov.info file in coverage directory

Output requirements:
- Return ONLY a JSON array, nothing else
- Each object must have "file" (relative path from repo root) and "coverage" (percentage as number)
- Use the exact file paths as they appear in the coverage report
- Example format:
[
  {"file": "src/components/Header.tsx", "coverage": 85.5},
  {"file": "src/utils/helpers.ts", "coverage": 42.3},
  {"file": "src/index.ts", "coverage": 0}
]

Do not include any explanatory text, markdown formatting, or code blocks. Only output the raw JSON array.`;
  }
}
