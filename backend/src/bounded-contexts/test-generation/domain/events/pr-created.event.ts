export class PRCreatedEvent {
  constructor(
    public readonly testGenerationRequestId: string,
    public readonly jobId: string,
    public readonly prUrl: string,
    public readonly prNumber: number,
  ) {}
}
