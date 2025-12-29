export class SetRepositoryPathCommand {
  constructor(
    public readonly jobId: string,
    public readonly repositoryPath: string,
  ) {}
}
