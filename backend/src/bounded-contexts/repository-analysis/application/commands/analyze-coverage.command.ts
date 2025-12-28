export class AnalyzeCoverageCommand {
  constructor(
    public readonly repositoryId: string,
    public readonly onOutput?: (output: string) => void,
  ) {}
}
