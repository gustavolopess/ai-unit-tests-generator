export class AppendJobLogCommand {
  constructor(
    public readonly jobId: string,
    public readonly message: string,
  ) {}
}
