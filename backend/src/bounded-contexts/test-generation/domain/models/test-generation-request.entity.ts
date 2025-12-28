import { AggregateRoot } from '../../../../shared/kernel/entity.base';
import { TestGenerationId } from './test-generation-id.value-object';
import { FilePath } from './file-path.value-object';
import { TestGenerationStartedEvent } from '../events/test-generation-started.event';
import { TestsGeneratedEvent } from '../events/tests-generated.event';
import { PullRequestCreatedEvent } from '../events/pull-request-created.event';

export enum TestGenerationStatus {
  PENDING = 'PENDING',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface TestGenerationRequestProps {
  repositoryId: string;
  targetFilePath: FilePath;
  workingDirectory: string;
  status: TestGenerationStatus;
  createdAt: Date;
  completedAt?: Date;
  sessionId?: string;
  testFilePath?: string;
  coverage?: number;
  error?: string;
  pullRequest?: {
    url: string;
    number: number;
    createdAt: Date;
  };
}

export class TestGenerationRequest extends AggregateRoot<TestGenerationId> {
  private props: TestGenerationRequestProps;

  private constructor(id: TestGenerationId, props: TestGenerationRequestProps) {
    super(id);
    this.props = props;
  }

  static create(
    repositoryId: string,
    targetFilePath: FilePath,
    workingDirectory: string,
  ): TestGenerationRequest {
    const id = TestGenerationId.generate();
    const request = new TestGenerationRequest(id, {
      repositoryId,
      targetFilePath,
      workingDirectory,
      status: TestGenerationStatus.PENDING,
      createdAt: new Date(),
    });

    request.apply(
      new TestGenerationStartedEvent(id, repositoryId, targetFilePath.getValue()),
    );

    return request;
  }

  static reconstitute(
    id: TestGenerationId,
    props: TestGenerationRequestProps,
  ): TestGenerationRequest {
    return new TestGenerationRequest(id, props);
  }

  // Getters
  get repositoryId(): string {
    return this.props.repositoryId;
  }

  get targetFilePath(): FilePath {
    return this.props.targetFilePath;
  }

  get workingDirectory(): string {
    return this.props.workingDirectory;
  }

  get status(): TestGenerationStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get completedAt(): Date | undefined {
    return this.props.completedAt;
  }

  get sessionId(): string | undefined {
    return this.props.sessionId;
  }

  get testFilePath(): string | undefined {
    return this.props.testFilePath;
  }

  get coverage(): number | undefined {
    return this.props.coverage;
  }

  get error(): string | undefined {
    return this.props.error;
  }

  get pullRequest(): TestGenerationRequestProps['pullRequest'] {
    return this.props.pullRequest;
  }

  // Business logic methods
  markAsGenerating(): void {
    if (this.props.status !== TestGenerationStatus.PENDING) {
      throw new Error('Can only start generation from PENDING status');
    }
    this.props.status = TestGenerationStatus.GENERATING;
  }

  completeGeneration(
    sessionId: string,
    testFilePath?: string,
    coverage?: number,
  ): void {
    if (this.props.status !== TestGenerationStatus.GENERATING) {
      throw new Error('Can only complete generation from GENERATING status');
    }

    this.props.status = TestGenerationStatus.COMPLETED;
    this.props.completedAt = new Date();
    this.props.sessionId = sessionId;
    this.props.testFilePath = testFilePath;
    this.props.coverage = coverage;

    this.apply(
      new TestsGeneratedEvent(
        this.id,
        this.props.repositoryId,
        this.props.targetFilePath.getValue(),
        sessionId,
        testFilePath,
        coverage,
      ),
    );
  }

  fail(error: string): void {
    this.props.status = TestGenerationStatus.FAILED;
    this.props.completedAt = new Date();
    this.props.error = error;
  }

  setPullRequest(url: string, number: number): void {
    if (!this.props.sessionId) {
      throw new Error('Cannot create PR without session ID');
    }

    this.props.pullRequest = {
      url,
      number,
      createdAt: new Date(),
    };

    this.apply(
      new PullRequestCreatedEvent(
        this.id,
        this.props.repositoryId,
        url,
        number,
      ),
    );
  }

  // Helper methods
  isCompleted(): boolean {
    return this.props.status === TestGenerationStatus.COMPLETED;
  }

  hasPullRequest(): boolean {
    return this.props.pullRequest !== undefined;
  }

  canCreatePullRequest(): boolean {
    return (
      this.props.status === TestGenerationStatus.COMPLETED &&
      this.props.sessionId !== undefined &&
      this.props.pullRequest === undefined
    );
  }
}
