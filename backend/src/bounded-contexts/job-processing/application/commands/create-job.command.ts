export class CreateJobCommand {
  constructor(
    public readonly repositoryUrl: string,
    public readonly entrypoint?: string,
    public readonly targetFilePath?: string,
    public readonly parentJobId?: string,
  ) {}
}
