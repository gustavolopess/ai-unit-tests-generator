export class SetPRResultCommand {
  constructor(
    public readonly jobId: string,
    public readonly prResult: {
      prUrl: string;
      prNumber: number;
    },
  ) {}
}
