import { Repository } from '../models/repository.entity';
import { RepositoryId } from '../models/repository-id.value-object';
import { RepositoryUrl } from '../models/repository-url.value-object';

export const REPOSITORY_REPOSITORY = Symbol('REPOSITORY_REPOSITORY');

export interface IRepositoryRepository {
  save(repository: Repository): Promise<void>;
  findById(id: RepositoryId): Promise<Repository | null>;
  findByUrl(url: RepositoryUrl): Promise<Repository | null>;
  delete(id: RepositoryId): Promise<void>;
}
