export class CoverageAnalysisFailedEvent {
  constructor(
    public readonly repositoryId: string,
    public readonly error: string,
  ) {}
}
