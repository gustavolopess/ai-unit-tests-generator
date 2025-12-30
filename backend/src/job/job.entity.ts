import { FileCoverageDto } from '../bounded-contexts/job-processing/application/dto/job-response.dto';

export enum JobStatus {
  PENDING = 'PENDING',
  CLONING = 'CLONING',
  INSTALLING = 'INSTALLING',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  GENERATING_TESTS = 'GENERATING_TESTS',
  TEST_GENERATION_COMPLETED = 'TEST_GENERATION_COMPLETED',
  TEST_GENERATION_FAILED = 'TEST_GENERATION_FAILED',
  CREATING_PR = 'CREATING_PR',
  PR_CREATED = 'PR_CREATED',
  PR_CREATION_FAILED = 'PR_CREATION_FAILED',
}

export enum JobType {
  COVERAGE_ANALYSIS = 'COVERAGE_ANALYSIS',
  TEST_GENERATION = 'TEST_GENERATION',
  PR_CREATION = 'PR_CREATION',
}

export interface Job {
  id: string;
  type: JobType;
  repositoryUrl: string;
  repositoryPath?: string; // Path to cloned repository on disk
  entrypoint?: string; // Subdirectory to use as working directory (e.g., "packages/api")
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  output: string[];
  sessionId?: string; // Claude CLI session ID for continuing conversations
  result?: {
    totalFiles: number;
    averageCoverage: number;
    files: FileCoverageDto[];
  };
  testGenerationResult?: {
    filePath: string;
    summary: string;
    testFilePath?: string;
    coverage?: number;
  };
  prCreationResult?: {
    prUrl: string;
    prNumber: number;
    summary: string;
  };
  parentJobId?: string; // For test generation jobs, references the analysis job
  targetFilePath?: string; // For test generation jobs, the file to generate tests for
}
