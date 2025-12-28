export class CreatePullRequestCommand {
  constructor(
    public readonly testGenerationRequestId: string,
    public readonly onOutput?: (output: string) => void,
  ) {}
}
