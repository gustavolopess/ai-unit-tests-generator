import { Injectable, Logger } from '@nestjs/common';
import { claude } from '@instantlyeasy/claude-code-sdk-ts';
import {
  IPullRequestCreator,
  PullRequestResult,
} from '@/bounded-contexts/test-generation/domain/services/pull-request-creator.interface';

@Injectable()
export class ClaudePullRequestCreatorService implements IPullRequestCreator {
  private readonly logger = new Logger(ClaudePullRequestCreatorService.name);

  async createPullRequest(
    workingDirectory: string,
    sessionId: string,
    onOutput?: (output: string) => void,
  ): Promise<PullRequestResult> {
    const prompt = this.buildPRCreationPrompt();
    let prUrl = '';
    let prNumber = 0;
    let summary = '';

    try {
      this.logger.log(
        `Creating PR using session ${sessionId} in ${workingDirectory}`,
      );

      if (onOutput) {
        onOutput(`Creating pull request...`);
        onOutput(`Using session ID: ${sessionId}`);
      }

      const result = await claude()
        .inDirectory(workingDirectory)
        .skipPermissions()
        .withSessionId(sessionId)
        .onMessage((msg) => {
          const msgStr = JSON.stringify(msg);
          this.logger.log(`[Claude message] ${msgStr}`);

          // Capture text from assistant messages
          if (msg.type === 'assistant') {
            const textBlocks = msg.content.filter(
              (block) => block.type === 'text',
            );
            const text = textBlocks.map((block: any) => block.text).join('\n');
            summary += text;

            // Try to extract PR URL from text
            const urlMatch = text.match(
              /https:\/\/github\.com\/[^\s]+\/pull\/(\d+)/,
            );
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
        const urlMatch = (result || summary).match(
          /https:\/\/github\.com\/[^\s]+\/pull\/(\d+)/,
        );
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
    return `
Please create a pull request with the tests you just generated.

Steps:
1. Review the changes you made (git status, git diff)
2. Commit the new test files with a descriptive commit message
3. Push the changes to a new branch
4. Create a pull request with a clear title and description explaining:
   - What tests were added
   - What functionality is now covered
   - Any important notes about the tests

Make sure the PR description is informative and professional.
`;
  }
}
