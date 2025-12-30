export class PRCreationFailedEvent {
  constructor(
    public readonly testGenerationRequestId: string,
    public readonly jobId: string,
    public readonly error: string,
  ) {}
}
