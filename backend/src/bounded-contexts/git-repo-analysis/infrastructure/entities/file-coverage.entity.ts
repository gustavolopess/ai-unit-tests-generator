import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { GitRepoEntity } from './git-repo.entity';

@Entity('file_coverages')
@Index(['repositoryId', 'filePath'], { unique: true })
export class FileCoverageEntity {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Column({
    name: 'repository_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  @Index()
  repositoryId: string;

  @Column({ name: 'file_path', type: 'varchar', length: 500 })
  filePath: string;

  @Column({
    name: 'coverage_percentage',
    type: 'decimal',
    precision: 5,
    scale: 2,
  })
  @Index()
  coveragePercentage: number;

  @Column({ name: 'lines_covered', type: 'integer', nullable: true })
  linesCovered?: number;

  @Column({ name: 'lines_total', type: 'integer', nullable: true })
  linesTotal?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => GitRepoEntity, (repository) => repository.fileCoverages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'repository_id' })
  repository: GitRepoEntity;
}
