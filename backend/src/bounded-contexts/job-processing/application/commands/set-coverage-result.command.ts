export class SetCoverageResultCommand {
  constructor(
    public readonly jobId: string,
    public readonly coverageResult: {
      totalFiles: number;
      averageCoverage: number;
      files: Array<{ file: string; coverage: number }>;
    },
  ) {}
}
