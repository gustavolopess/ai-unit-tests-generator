import { Injectable } from '@nestjs/common';
import { IRepositoryRepository } from '../domain/repositories/repository.repository.interface';
import { Repository } from '../domain/models/repository.entity';
import { RepositoryId } from '../domain/models/repository-id.value-object';
import { RepositoryUrl } from '../domain/models/repository-url.value-object';

@Injectable()
export class InMemoryRepositoryRepository implements IRepositoryRepository {
  private readonly repositories = new Map<string, Repository>();

  async save(repository: Repository): Promise<void> {
    this.repositories.set(repository.id.getValue(), repository);
  }

  async findById(id: RepositoryId): Promise<Repository | null> {
    return this.repositories.get(id.getValue()) || null;
  }

  async findByUrl(url: RepositoryUrl): Promise<Repository | null> {
    const normalized = url.getNormalized();

    for (const repository of this.repositories.values()) {
      if (repository.url.getNormalized() === normalized) {
        return repository;
      }
    }

    return null;
  }

  async delete(id: RepositoryId): Promise<void> {
    this.repositories.delete(id.getValue());
  }
}
