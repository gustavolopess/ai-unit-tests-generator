export class CreateJobCommand {
  constructor(
    public readonly repositoryId: string,
    public readonly targetFilePath?: string,
    public readonly parentJobId?: string,
  ) {}
}
