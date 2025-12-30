export class TestGenerationCompletedEvent {
  constructor(
    public readonly testGenerationRequestId: string,
    public readonly jobId: string,
    public readonly sessionId: string,
  ) {}
}
