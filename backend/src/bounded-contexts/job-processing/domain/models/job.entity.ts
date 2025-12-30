import { AggregateRoot } from '../../../../shared/kernel/entity.base';
import { JobId } from './job-id.value-object';
import { JobStatus } from './job-status.enum';
import { JobCreatedEvent } from '../events/job-created.event';
import { JobStatusChangedEvent } from '../events/job-status-changed.event';
import { JobCompletedEvent } from '../events/job-completed.event';
import { JobFailedEvent } from '../events/job-failed.event';

export interface JobProps {
  repositoryId: string; // FK to repositories table
  targetFilePath?: string; // File to generate tests for (optional)
  entrypoint?: string; // Optional subdirectory path for monorepos
  parentJobId?: string; // Reference to parent job for reusing analysis results
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  logPath?: string; // Path to log file (e.g., data/logs/<job_id>.log)
  error?: string;
  repositoryPath?: string;
  sessionId?: string;
  testGenerationRequestId?: string;
  coverageResult?: {
    totalFiles: number;
    averageCoverage: number;
    files: Array<{ file: string; coverage: number }>;
  };
  testGenerationResult?: {
    filePath: string;
    testFilePath?: string;
    coverage?: number;
  };
  prCreationResult?: {
    prUrl: string;
    prNumber: number;
  };
}

export class Job extends AggregateRoot<JobId> {
  private props: JobProps;

  private constructor(id: JobId, props: JobProps) {
    super(id);
    this.props = props;
  }

  static create(
    repositoryId: string,
    targetFilePath?: string,
    parentJobId?: string,
    entrypoint?: string,
  ): Job {
    const jobId = JobId.generate();
    const job = new Job(jobId, {
      repositoryId,
      targetFilePath,
      entrypoint,
      parentJobId,
      status: JobStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    job.apply(new JobCreatedEvent(jobId, repositoryId));
    return job;
  }

  static reconstitute(id: JobId, props: JobProps): Job {
    return new Job(id, props);
  }

  // Getters
  get repositoryId(): string {
    return this.props.repositoryId;
  }

  get targetFilePath(): string | undefined {
    return this.props.targetFilePath;
  }

  get entrypoint(): string | undefined {
    return this.props.entrypoint;
  }

  get parentJobId(): string | undefined {
    return this.props.parentJobId;
  }

  get status(): JobStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get startedAt(): Date | undefined {
    return this.props.startedAt;
  }

  get completedAt(): Date | undefined {
    return this.props.completedAt;
  }

  get logPath(): string | undefined {
    return this.props.logPath;
  }

  get error(): string | undefined {
    return this.props.error;
  }

  get repositoryPath(): string | undefined {
    return this.props.repositoryPath;
  }

  get sessionId(): string | undefined {
    return this.props.sessionId;
  }

  get testGenerationRequestId(): string | undefined {
    return this.props.testGenerationRequestId;
  }

  get coverageResult(): JobProps['coverageResult'] | undefined {
    return this.props.coverageResult;
  }

  get testGenerationResult(): JobProps['testGenerationResult'] | undefined {
    return this.props.testGenerationResult;
  }

  get prCreationResult(): JobProps['prCreationResult'] | undefined {
    return this.props.prCreationResult;
  }

  // Business logic methods
  updateStatus(newStatus: JobStatus): void {
    const previousStatus = this.props.status;
    this.props.status = newStatus;
    this.props.updatedAt = new Date();

    if (
      newStatus === JobStatus.CLONING &&
      !this.props.startedAt
    ) {
      this.props.startedAt = new Date();
    }

    if (this.isTerminalStatus(newStatus)) {
      this.props.completedAt = new Date();

      if (this.isCompletedStatus(newStatus)) {
        this.apply(new JobCompletedEvent(this.id));
      }
    }

    this.apply(new JobStatusChangedEvent(this.id, previousStatus, newStatus));
  }

  setLogPath(logPath: string): void {
    this.props.logPath = logPath;
    this.props.updatedAt = new Date();
  }

  setError(error: string): void {
    this.props.error = error;
    this.props.status = JobStatus.FAILED;
    this.props.completedAt = new Date();
    this.props.updatedAt = new Date();

    this.apply(new JobFailedEvent(this.id, error));
  }

  setRepositoryPath(path: string): void {
    this.props.repositoryPath = path;
    this.props.updatedAt = new Date();
  }

  setCoverageResult(result: JobProps['coverageResult']): void {
    this.props.coverageResult = result;
    this.props.updatedAt = new Date();
  }

  setTestGenerationResult(result: JobProps['testGenerationResult']): void {
    this.props.testGenerationResult = result;
    this.props.updatedAt = new Date();
  }

  setPRCreationResult(result: JobProps['prCreationResult']): void {
    this.props.prCreationResult = result;
    this.props.updatedAt = new Date();
  }

  setSessionId(sessionId: string): void {
    this.props.sessionId = sessionId;
    this.props.updatedAt = new Date();
  }

  setTargetFilePath(filePath: string): void {
    this.props.targetFilePath = filePath;
    this.props.updatedAt = new Date();
  }

  setTestGenerationRequestId(requestId: string): void {
    this.props.testGenerationRequestId = requestId;
    this.props.updatedAt = new Date();
  }

  inheritFromParent(parentJob: Job): void {
    if (!this.isChildJob()) {
      throw new Error('Cannot inherit from parent: this is not a child job');
    }

    // Inherit repository path and coverage results from parent
    this.props.repositoryPath = parentJob.repositoryPath;
    this.props.coverageResult = parentJob.coverageResult;
    this.props.updatedAt = new Date();
  }

  // Helper methods
  private isTerminalStatus(status: JobStatus): boolean {
    return [
      JobStatus.ANALYSIS_COMPLETED,
      JobStatus.TEST_GENERATION_COMPLETED,
      JobStatus.PR_CREATION_COMPLETED,
      JobStatus.COMPLETED,
      JobStatus.FAILED,
    ].includes(status);
  }

  private isCompletedStatus(status: JobStatus): boolean {
    return [
      JobStatus.ANALYSIS_COMPLETED,
      JobStatus.TEST_GENERATION_COMPLETED,
      JobStatus.PR_CREATION_COMPLETED,
      JobStatus.COMPLETED,
    ].includes(status);
  }

  // Validation methods for stage prerequisites
  isChildJob(): boolean {
    return this.props.parentJobId !== undefined;
  }

  needsCloning(): boolean {
    return !this.props.repositoryPath;
  }

  needsDependencyInstallation(): boolean {
    // We assume if repository is cloned, we need to check if dependencies are installed
    // This is a simplification - in production, you might check for node_modules existence
    return this.props.repositoryPath !== undefined &&
           this.props.status === JobStatus.CLONING;
  }

  needsCoverageAnalysis(): boolean {
    return this.props.coverageResult == null;
  }

  needsTestGeneration(): boolean {
    return this.props.targetFilePath != null &&
           this.props.testGenerationResult == null;
  }

  needsPRCreation(): boolean {
    return this.props.testGenerationResult != null &&
           this.props.prCreationResult == null &&
           this.props.sessionId != null;
  }

  canGenerateTests(): boolean {
    return this.props.repositoryPath != null &&
           this.props.targetFilePath != null;
  }

  canCreatePR(): boolean {
    return this.props.sessionId != null &&
           this.props.testGenerationResult != null;
  }
}
