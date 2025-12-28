export class AppendJobOutputCommand {
  constructor(
    public readonly jobId: string,
    public readonly output: string,
  ) {}
}
