export class GenerateTestsCommand {
  constructor(
    public readonly repositoryId: string,
    public readonly workingDirectory: string,
    public readonly targetFilePath: string,
    public readonly onOutput?: (output: string) => void,
  ) {}
}
