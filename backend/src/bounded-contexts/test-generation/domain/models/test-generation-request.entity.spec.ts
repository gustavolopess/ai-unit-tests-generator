import {
  TestGenerationRequest,
  TestGenerationRequestProps,
  TestGenerationStatus,
} from './test-generation-request.entity';
import { TestGenerationId } from './test-generation-id.value-object';
import { FilePath } from './file-path.value-object';
import { TestGenerationStartedEvent } from '@/bounded-contexts/test-generation/domain/events/test-generation-started.event';
import { TestsGeneratedEvent } from '@/bounded-contexts/test-generation/domain/events/tests-generated.event';
import { PullRequestCreatedEvent } from '@/bounded-contexts/test-generation/domain/events/pull-request-created.event';

describe('TestGenerationRequest Entity', () => {
  const repositoryId = 'repo-123';
  const workingDirectory = '/tmp/repo';
  const createFilePath = () => FilePath.create('src/service.ts');

  describe('create', () => {
    it('should create a new request with PENDING status', () => {
      const filePath = createFilePath();
      const request = TestGenerationRequest.create(
        repositoryId,
        filePath,
        workingDirectory,
      );

      expect(request.repositoryId).toBe(repositoryId);
      expect(request.targetFilePath).toBe(filePath);
      expect(request.workingDirectory).toBe(workingDirectory);
      expect(request.status).toBe(TestGenerationStatus.PENDING);
      expect(request.createdAt).toBeInstanceOf(Date);
    });

    it('should emit TestGenerationStartedEvent', () => {
      const request = TestGenerationRequest.create(
        repositoryId,
        createFilePath(),
        workingDirectory,
      );

      expect(request.domainEvents).toHaveLength(1);
      expect(request.domainEvents[0]).toBeInstanceOf(
        TestGenerationStartedEvent,
      );
    });

    it('should generate a unique ID', () => {
      const filePath = createFilePath();
      const req1 = TestGenerationRequest.create(
        repositoryId,
        filePath,
        workingDirectory,
      );
      const req2 = TestGenerationRequest.create(
        repositoryId,
        filePath,
        workingDirectory,
      );

      expect(req1.id.getValue()).not.toBe(req2.id.getValue());
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute from props without emitting events', () => {
      const id = TestGenerationId.generate();
      const filePath = createFilePath();
      const props: TestGenerationRequestProps = {
        repositoryId,
        targetFilePath: filePath,
        workingDirectory,
        status: TestGenerationStatus.GENERATING,
        createdAt: new Date('2024-01-01'),
      };

      const request = TestGenerationRequest.reconstitute(id, props);

      expect(request.id).toBe(id);
      expect(request.status).toBe(TestGenerationStatus.GENERATING);
      expect(request.domainEvents).toHaveLength(0);
    });
  });

  describe('markAsGenerating', () => {
    it('should transition from PENDING to GENERATING', () => {
      const request = TestGenerationRequest.create(
        repositoryId,
        createFilePath(),
        workingDirectory,
      );

      request.markAsGenerating();

      expect(request.status).toBe(TestGenerationStatus.GENERATING);
    });

    it('should throw error if not in PENDING status', () => {
      const request = TestGenerationRequest.create(
        repositoryId,
        createFilePath(),
        workingDirectory,
      );
      request.markAsGenerating();

      expect(() => request.markAsGenerating()).toThrow(
        'Can only start generation from PENDING status',
      );
    });
  });

  describe('completeGeneration', () => {
    it('should transition from GENERATING to COMPLETED', () => {
      const request = TestGenerationRequest.create(
        repositoryId,
        createFilePath(),
        workingDirectory,
      );
      request.markAsGenerating();
      request.clearEvents();

      request.completeGeneration('session-123', 'src/service.spec.ts', 85);

      expect(request.status).toBe(TestGenerationStatus.COMPLETED);
      expect(request.sessionId).toBe('session-123');
      expect(request.testFilePath).toBe('src/service.spec.ts');
      expect(request.coverage).toBe(85);
      expect(request.completedAt).toBeInstanceOf(Date);
    });

    it('should emit TestsGeneratedEvent', () => {
      const request = TestGenerationRequest.create(
        repositoryId,
        createFilePath(),
        workingDirectory,
      );
      request.markAsGenerating();
      request.clearEvents();

      request.completeGeneration('session-123');

      expect(request.domainEvents).toHaveLength(1);
      expect(request.domainEvents[0]).toBeInstanceOf(TestsGeneratedEvent);
    });

    it('should throw error if not in GENERATING status', () => {
      const request = TestGenerationRequest.create(
        repositoryId,
        createFilePath(),
        workingDirectory,
      );

      expect(() => request.completeGeneration('session-123')).toThrow(
        'Can only complete generation from GENERATING status',
      );
    });

    it('should allow completion without testFilePath and coverage', () => {
      const request = TestGenerationRequest.create(
        repositoryId,
        createFilePath(),
        workingDirectory,
      );
      request.markAsGenerating();

      request.completeGeneration('session-123');

      expect(request.testFilePath).toBeUndefined();
      expect(request.coverage).toBeUndefined();
    });
  });

  describe('fail', () => {
    it('should set status to FAILED and record error', () => {
      const request = TestGenerationRequest.create(
        repositoryId,
        createFilePath(),
        workingDirectory,
      );
      const errorMessage = 'Test generation failed';

      request.fail(errorMessage);

      expect(request.status).toBe(TestGenerationStatus.FAILED);
      expect(request.error).toBe(errorMessage);
      expect(request.completedAt).toBeInstanceOf(Date);
    });

    it('should allow failure from any state', () => {
      const request = TestGenerationRequest.create(
        repositoryId,
        createFilePath(),
        workingDirectory,
      );
      request.markAsGenerating();

      request.fail('Error');

      expect(request.status).toBe(TestGenerationStatus.FAILED);
    });
  });

  describe('setPullRequest', () => {
    it('should set pull request data', () => {
      const request = TestGenerationRequest.create(
        repositoryId,
        createFilePath(),
        workingDirectory,
      );
      request.markAsGenerating();
      request.completeGeneration('session-123');
      request.clearEvents();

      request.setPullRequest('https://github.com/user/repo/pull/1', 1);

      expect(request.pullRequest).toBeDefined();
      expect(request.pullRequest!.url).toBe(
        'https://github.com/user/repo/pull/1',
      );
      expect(request.pullRequest!.number).toBe(1);
      expect(request.pullRequest!.createdAt).toBeInstanceOf(Date);
    });

    it('should emit PullRequestCreatedEvent', () => {
      const request = TestGenerationRequest.create(
        repositoryId,
        createFilePath(),
        workingDirectory,
      );
      request.markAsGenerating();
      request.completeGeneration('session-123');
      request.clearEvents();

      request.setPullRequest('https://github.com/user/repo/pull/1', 1);

      expect(request.domainEvents).toHaveLength(1);
      expect(request.domainEvents[0]).toBeInstanceOf(PullRequestCreatedEvent);
    });

    it('should throw error if no sessionId', () => {
      const id = TestGenerationId.generate();
      const filePath = createFilePath();
      const props: TestGenerationRequestProps = {
        repositoryId,
        targetFilePath: filePath,
        workingDirectory,
        status: TestGenerationStatus.COMPLETED,
        createdAt: new Date(),
        completedAt: new Date(),
        // No sessionId
      };
      const request = TestGenerationRequest.reconstitute(id, props);

      expect(() => request.setPullRequest('url', 1)).toThrow(
        'Cannot create PR without session ID',
      );
    });
  });

  describe('isCompleted', () => {
    it('should return true when COMPLETED', () => {
      const request = TestGenerationRequest.create(
        repositoryId,
        createFilePath(),
        workingDirectory,
      );
      request.markAsGenerating();
      request.completeGeneration('session-123');

      expect(request.isCompleted()).toBe(true);
    });

    it('should return false when not COMPLETED', () => {
      const request = TestGenerationRequest.create(
        repositoryId,
        createFilePath(),
        workingDirectory,
      );

      expect(request.isCompleted()).toBe(false);
    });
  });

  describe('hasPullRequest', () => {
    it('should return false when no pull request', () => {
      const request = TestGenerationRequest.create(
        repositoryId,
        createFilePath(),
        workingDirectory,
      );

      expect(request.hasPullRequest()).toBe(false);
    });

    it('should return true when pull request exists', () => {
      const request = TestGenerationRequest.create(
        repositoryId,
        createFilePath(),
        workingDirectory,
      );
      request.markAsGenerating();
      request.completeGeneration('session-123');
      request.setPullRequest('url', 1);

      expect(request.hasPullRequest()).toBe(true);
    });
  });

  describe('canCreatePullRequest', () => {
    it('should return true when COMPLETED, has sessionId, and no PR yet', () => {
      const request = TestGenerationRequest.create(
        repositoryId,
        createFilePath(),
        workingDirectory,
      );
      request.markAsGenerating();
      request.completeGeneration('session-123');

      expect(request.canCreatePullRequest()).toBe(true);
    });

    it('should return false when not COMPLETED', () => {
      const request = TestGenerationRequest.create(
        repositoryId,
        createFilePath(),
        workingDirectory,
      );
      request.markAsGenerating();

      expect(request.canCreatePullRequest()).toBe(false);
    });

    it('should return false when no sessionId', () => {
      const id = TestGenerationId.generate();
      const filePath = createFilePath();
      const props: TestGenerationRequestProps = {
        repositoryId,
        targetFilePath: filePath,
        workingDirectory,
        status: TestGenerationStatus.COMPLETED,
        createdAt: new Date(),
      };
      const request = TestGenerationRequest.reconstitute(id, props);

      expect(request.canCreatePullRequest()).toBe(false);
    });

    it('should return false when PR already exists', () => {
      const request = TestGenerationRequest.create(
        repositoryId,
        createFilePath(),
        workingDirectory,
      );
      request.markAsGenerating();
      request.completeGeneration('session-123');
      request.setPullRequest('url', 1);

      expect(request.canCreatePullRequest()).toBe(false);
    });
  });
});
