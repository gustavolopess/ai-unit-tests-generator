import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RepositoryEntity } from '../../../repository-analysis/infrastructure/entities/repository.entity';

@Entity('jobs')
export class JobEntity {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column({ name: 'parent_job_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  parentJobId?: string;

  @Column({ name: 'repository_id', type: 'varchar', length: 36 })
  @Index()
  repositoryId: string;

  @ManyToOne(() => RepositoryEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'repository_id' })
  repository?: RepositoryEntity;

  @Column({ name: 'target_file_path', type: 'varchar', length: 500, nullable: true })
  targetFilePath?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  entrypoint?: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'started_at', type: 'datetime', nullable: true })
  startedAt?: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt?: Date;

  @Column({ name: 'log_path', type: 'varchar', length: 500, nullable: true })
  logPath?: string;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column({ name: 'repository_path', type: 'varchar', length: 500, nullable: true })
  repositoryPath?: string;

  @Column({ name: 'session_id', type: 'varchar', length: 255, nullable: true })
  sessionId?: string;

  @Column({
    name: 'test_generation_request_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  testGenerationRequestId?: string;

  @Column({ name: 'coverage_result', type: 'simple-json', nullable: true })
  coverageResult?: {
    totalFiles: number;
    averageCoverage: number;
    files: Array<{ file: string; coverage: number }>;
  };

  @Column({ name: 'test_generation_result', type: 'simple-json', nullable: true })
  testGenerationResult?: {
    filePath: string;
    testFilePath?: string;
    coverage?: number;
  };

  @Column({ name: 'pr_creation_result', type: 'simple-json', nullable: true })
  prCreationResult?: {
    prUrl: string;
    prNumber: number;
  };
}
