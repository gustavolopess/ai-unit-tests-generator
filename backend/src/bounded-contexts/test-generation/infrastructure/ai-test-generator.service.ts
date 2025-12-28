import { Injectable, Logger } from '@nestjs/common';
import { claude } from '@instantlyeasy/claude-code-sdk-ts';
import { ITestGenerator, TestGenerationResult } from '../domain/services/test-generator.interface';

@Injectable()
export class AITestGeneratorService implements ITestGenerator {
  private readonly logger = new Logger(AITestGeneratorService.name);

  async generateTests(
    workingDirectory: string,
    targetFilePath: string,
    onOutput?: (output: string) => void,
  ): Promise<TestGenerationResult> {
    const prompt = this.buildTestGenerationPrompt(targetFilePath);
    let summary = '';
    let sessionId: string | undefined;

    try {
      this.logger.log(`Generating tests for ${targetFilePath} in ${workingDirectory}`);

      if (onOutput) {
        onOutput(`Starting test generation for ${targetFilePath}...`);
      }

      const result = await claude()
        .inDirectory(workingDirectory)
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

      if (!sessionId) {
        throw new Error('No session ID received from Claude');
      }

      this.logger.log(`Test generation completed successfully`);
      this.logger.log(`Session ID: ${sessionId}`);

      if (onOutput) {
        onOutput(`Test generation completed`);
        onOutput(`Session ID: ${sessionId}`);
      }

      return {
        sessionId,
        testFilePath: undefined, // Claude doesn't return this explicitly
        coverage: undefined, // Would need to run tests to get this
      };
    } catch (error) {
      this.logger.error(`Test generation failed: ${error.message}`);
      if (onOutput) {
        onOutput(`ERROR: ${error.message}`);
      }
      throw new Error(`Failed to generate tests: ${error.message}`);
    }
  }

  private buildTestGenerationPrompt(filePath: string): string {
    return `
You are a test generation expert. Generate comprehensive unit tests for the file: ${filePath}

Requirements:
1. Analyze the file and understand its functionality
2. Create a new test file following the project's conventions (e.g., *.spec.ts, *.test.ts)
3. Write comprehensive tests covering:
   - Happy path scenarios
   - Edge cases
   - Error handling
   - All public methods/functions
4. Use the testing framework already configured in the project
5. Follow the project's existing test patterns and style
6. Ensure tests are maintainable and well-documented

After generating the tests, run them to verify they work correctly.
`;
  }
}
