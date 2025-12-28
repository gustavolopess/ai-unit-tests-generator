import { AggregateRoot } from '../../../../shared/kernel/entity.base';
import { JobId } from './job-id.value-object';
import { JobStatus } from './job-status.enum';
import { JobCreatedEvent } from '../events/job-created.event';
import { JobStatusChangedEvent } from '../events/job-status-changed.event';
import { JobCompletedEvent } from '../events/job-completed.event';
import { JobFailedEvent } from '../events/job-failed.event';

export interface JobProps {
  repositoryUrl: string;
  entrypoint?: string;
  targetFilePath?: string; // File to generate tests for (optional)
  parentJobId?: string; // Reference to parent job for reusing analysis results
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  output: string[];
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
    repositoryUrl: string,
    entrypoint?: string,
    targetFilePath?: string,
    parentJobId?: string,
  ): Job {
    const jobId = JobId.generate();
    const job = new Job(jobId, {
      repositoryUrl,
      entrypoint,
      targetFilePath,
      parentJobId,
      status: JobStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      output: [],
    });

    job.apply(new JobCreatedEvent(jobId, repositoryUrl));
    return job;
  }

  static reconstitute(id: JobId, props: JobProps): Job {
    return new Job(id, props);
  }

  // Getters
  get repositoryUrl(): string {
    return this.props.repositoryUrl;
  }

  get entrypoint(): string | undefined {
    return this.props.entrypoint;
  }

  get targetFilePath(): string | undefined {
    return this.props.targetFilePath;
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

  get output(): string[] {
    return [...this.props.output];
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

  appendOutput(output: string): void {
    this.props.output.push(output);
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
    return this.props.coverageResult === undefined;
  }

  needsTestGeneration(): boolean {
    return this.props.targetFilePath !== undefined &&
           this.props.testGenerationResult === undefined;
  }

  needsPRCreation(): boolean {
    return this.props.testGenerationResult !== undefined &&
           this.props.prCreationResult === undefined &&
           this.props.sessionId !== undefined;
  }

  canGenerateTests(): boolean {
    return this.props.repositoryPath !== undefined &&
           this.props.targetFilePath !== undefined;
  }

  canCreatePR(): boolean {
    return this.props.sessionId !== undefined &&
           this.props.testGenerationResult !== undefined;
  }
}
