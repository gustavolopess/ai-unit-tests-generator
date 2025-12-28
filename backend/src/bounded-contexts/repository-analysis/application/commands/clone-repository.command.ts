export class CloneRepositoryCommand {
  constructor(
    public readonly repositoryUrl: string,
    public readonly entrypoint?: string,
  ) {}
}
