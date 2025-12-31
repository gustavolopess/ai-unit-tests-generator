import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('test_generation_requests')
export class TestGenerationRequestEntity {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column({ name: 'repository_id', type: 'varchar', length: 500 })
  @Index()
  repositoryId: string;

  @Column({ name: 'target_file_path', type: 'varchar', length: 500 })
  targetFilePath: string;

  @Column({ name: 'working_directory', type: 'varchar', length: 500 })
  workingDirectory: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt?: Date;

  @Column({ name: 'session_id', type: 'varchar', length: 255, nullable: true })
  @Index()
  sessionId?: string;

  @Column({
    name: 'test_file_path',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  testFilePath?: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  coverage?: number;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column({ name: 'pull_request', type: 'simple-json', nullable: true })
  pullRequest?: {
    url: string;
    number: number;
    createdAt: Date;
  };
}
