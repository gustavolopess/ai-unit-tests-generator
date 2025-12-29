import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { IRepositoryRepository } from '../domain/repositories/repository.repository.interface';
import { Repository } from '../domain/models/repository.entity';
import { RepositoryId } from '../domain/models/repository-id.value-object';
import { RepositoryUrl } from '../domain/models/repository-url.value-object';
import { RepositoryEntity } from './entities/repository.entity';
import { FileCoverageEntity } from './entities/file-coverage.entity';
import { FileCoverage } from '../domain/models/file-coverage.entity';
import { randomUUID } from 'crypto';

@Injectable()
export class TypeOrmRepositoryRepository implements IRepositoryRepository {
  private readonly logger = new Logger(TypeOrmRepositoryRepository.name);

  constructor(
    @InjectRepository(RepositoryEntity)
    private readonly repository: TypeOrmRepository<RepositoryEntity>,
    @InjectRepository(FileCoverageEntity)
    private readonly fileCoverageRepository: TypeOrmRepository<FileCoverageEntity>,
  ) {}

  async save(repo: Repository): Promise<void> {
    const entity = this.toEntity(repo);

    // Save repository
    await this.repository.save(entity);

    // Delete existing file coverages and save new ones
    await this.fileCoverageRepository.delete({ repositoryId: entity.id });

    if (repo.fileCoverages.length > 0) {
      const fileCoverageEntities = repo.fileCoverages.map((fc) => {
        const fcEntity = new FileCoverageEntity();
        fcEntity.id = randomUUID();
        fcEntity.repositoryId = entity.id;
        fcEntity.filePath = fc.filePath;
        fcEntity.coveragePercentage = fc.coveragePercentage;
        return fcEntity;
      });
      await this.fileCoverageRepository.save(fileCoverageEntities);
    }

    this.logger.log(`Repository saved: ${repo.id.getValue()}`);
  }

  async findById(id: RepositoryId): Promise<Repository | null> {
    const entity = await this.repository.findOne({
      where: { id: id.getValue() },
      relations: ['fileCoverages'],
    });

    if (!entity) {
      this.logger.warn(`Repository not found: ${id.getValue()}`);
      return null;
    }

    this.logger.log(`Repository found: ${id.getValue()}`);
    return this.toDomain(entity);
  }

  async findByUrl(url: RepositoryUrl): Promise<Repository | null> {
    const entity = await this.repository.findOne({
      where: { url: url.getValue() },
      relations: ['fileCoverages'],
    });

    if (!entity) {
      this.logger.warn(`Repository not found by URL: ${url.getValue()}`);
      return null;
    }

    this.logger.log(`Repository found by URL: ${url.getValue()}`);
    return this.toDomain(entity);
  }

  async delete(id: RepositoryId): Promise<void> {
    const result = await this.repository.delete(id.getValue());
    if (result.affected && result.affected > 0) {
      this.logger.log(`Repository deleted: ${id.getValue()}`);
    } else {
      this.logger.warn(`Repository not found for deletion: ${id.getValue()}`);
    }
  }

  // Mapper methods
  private toEntity(repo: Repository): RepositoryEntity {
    const entity = new RepositoryEntity();
    entity.id = repo.id.getValue();
    entity.url = repo.url.getValue();
    entity.entrypoint = repo.entrypoint;
    entity.localPath = repo.localPath;
    entity.status = repo.isCloned() ? 'CLONED' : 'PENDING';
    entity.clonedAt = repo.clonedAt;
    entity.lastAnalyzedAt = repo.lastAnalyzedAt;

    // Calculate average coverage
    const coverages = repo.fileCoverages;
    if (coverages.length > 0) {
      const sum = coverages.reduce((acc, fc) => acc + fc.coveragePercentage, 0);
      entity.averageCoverage = sum / coverages.length;
    }

    entity.fileCoverages = [];
    return entity;
  }

  private toDomain(entity: RepositoryEntity): Repository {
    const repositoryId = RepositoryId.create(entity.id);
    const repositoryUrl = RepositoryUrl.create(entity.url);

    const fileCoverages = (entity.fileCoverages || []).map((fc) =>
      FileCoverage.reconstitute(fc.filePath, {
        filePath: fc.filePath,
        coveragePercentage: fc.coveragePercentage,
        analyzedAt: fc.createdAt,
      }),
    );

    return Repository.reconstitute(repositoryId, {
      url: repositoryUrl,
      entrypoint: entity.entrypoint,
      localPath: entity.localPath,
      clonedAt: entity.clonedAt,
      lastAnalyzedAt: entity.lastAnalyzedAt,
      fileCoverages,
    });
  }
}
