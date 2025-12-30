export const GIT_SERVICE = Symbol('GIT_SERVICE');

export interface IGitService {
  clone(repositoryUrl: string): Promise<string>;
  cleanup(repositoryPath: string): Promise<void>;
  ensureMainBranchAndUpdate(repositoryPath: string): Promise<void>;
}
