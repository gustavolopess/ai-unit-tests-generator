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

    if (!entity.id) {
      throw new Error(`Repository entity has no ID: ${JSON.stringify(entity)}`);
    }

    this.logger.debug(`Saving repository ${entity.id} with ${repo.fileCoverages.length} file coverages`);
    this.logger.debug(`Entity fileCoverages array length: ${entity.fileCoverages?.length ?? 'undefined'}`);
    this.logger.debug(`Entity data: ${JSON.stringify({ id: entity.id, url: entity.url, status: entity.status })}`);

    // Save repository first to ensure it exists in the database
    let savedEntity: RepositoryEntity;
    try {
      savedEntity = await this.repository.save(entity);
      this.logger.debug(`Repository entity saved with ID: ${savedEntity.id}`);
    } catch (error) {
      this.logger.error(`Failed to save repository entity: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      throw error;
    }

    // Delete existing file coverages and save new ones
    await this.fileCoverageRepository.delete({ repositoryId: savedEntity.id });

    if (repo.fileCoverages.length > 0) {
      // Use raw SQL to completely bypass TypeORM's entity mapping
      const now = new Date().toISOString();
      let sql = ''; // Declare outside try block for error logging

      this.logger.debug(`Inserting ${repo.fileCoverages.length} file coverage entries for repository ${savedEntity.id}`);

      try {
        // Build bulk insert SQL
        const values = repo.fileCoverages.map((fc) => {
          const id = randomUUID();
          return `('${id}', '${savedEntity.id}', '${fc.filePath.replace(/'/g, "''")}', ${fc.coveragePercentage}, NULL, NULL, '${now}')`;
        }).join(', ');

        sql = `
          INSERT INTO file_coverages (id, repository_id, file_path, coverage_percentage, lines_covered, lines_total, created_at)
          VALUES ${values}
        `;

        this.logger.debug(`Executing raw SQL insert for ${repo.fileCoverages.length} file coverages`);
        this.logger.debug(`Repository ID being used: '${savedEntity.id}'`);
        this.logger.debug(`SQL Query (first 500 chars): ${sql.substring(0, 500)}`);

        await this.repository.query(sql);

        this.logger.debug(`Successfully inserted ${repo.fileCoverages.length} file coverage entities`);
      } catch (error) {
        this.logger.error(`Failed to insert file coverages: ${error.message}`);
        this.logger.error(`Repository ID: ${savedEntity.id}, type: ${typeof savedEntity.id}`);
        this.logger.error(`Full SQL (first 1000 chars): ${sql.substring(0, 1000)}`);
        throw error;
      }
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
      localPath: entity.localPath,
      clonedAt: entity.clonedAt,
      lastAnalyzedAt: entity.lastAnalyzedAt,
      fileCoverages,
    });
  }
}
