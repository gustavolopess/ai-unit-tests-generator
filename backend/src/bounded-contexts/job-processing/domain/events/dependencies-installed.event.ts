export class DependenciesInstalledEvent {
  constructor(
    public readonly jobId: string,
    public readonly repositoryPath: string,
  ) {}
}
