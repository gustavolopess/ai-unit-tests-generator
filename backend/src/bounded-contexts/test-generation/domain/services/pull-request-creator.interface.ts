export const PULL_REQUEST_CREATOR = Symbol('PULL_REQUEST_CREATOR');

export interface PullRequestResult {
  prUrl: string;
  prNumber: number;
}

export interface IPullRequestCreator {
  createPullRequest(
    workingDirectory: string,
    sessionId: string,
    onOutput?: (output: string) => void,
  ): Promise<PullRequestResult>;
}
