export class FailJobCommand {
  constructor(
    public readonly jobId: string,
    public readonly error: string,
  ) {}
}
