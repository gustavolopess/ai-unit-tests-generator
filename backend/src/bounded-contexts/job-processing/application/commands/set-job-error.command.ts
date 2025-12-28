export class SetJobErrorCommand {
  constructor(
    public readonly jobId: string,
    public readonly error: string,
  ) {}
}
