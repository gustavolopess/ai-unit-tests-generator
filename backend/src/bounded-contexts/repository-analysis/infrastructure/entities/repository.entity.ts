import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { FileCoverageEntity } from './file-coverage.entity';

@Entity('repositories')
export class RepositoryEntity {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 500, unique: true })
  @Index()
  url: string;

  @Column({ name: 'local_path', type: 'varchar', length: 500, nullable: true })
  localPath?: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'cloned_at', type: 'datetime', nullable: true })
  clonedAt?: Date;

  @Column({ name: 'last_analyzed_at', type: 'datetime', nullable: true })
  lastAnalyzedAt?: Date;

  @Column({ name: 'average_coverage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  averageCoverage?: number;

  @OneToMany(() => FileCoverageEntity, (fileCoverage) => fileCoverage.repository, {
    cascade: true,
  })
  fileCoverages: FileCoverageEntity[];
}
