export class AnalyzeCoverageCommand {
  constructor(
    public readonly repositoryId: string,
    public readonly entrypoint?: string,
    public readonly onOutput?: (output: string) => void,
  ) {}
}
