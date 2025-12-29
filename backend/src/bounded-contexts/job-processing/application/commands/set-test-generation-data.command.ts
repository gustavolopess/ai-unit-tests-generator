export class SetTestGenerationDataCommand {
  constructor(
    public readonly jobId: string,
    public readonly sessionId: string | undefined,
    public readonly testGenerationRequestId: string,
    public readonly testGenerationResult: {
      filePath: string;
      testFilePath: string | undefined;
      coverage: number | undefined;
    },
  ) {}
}
