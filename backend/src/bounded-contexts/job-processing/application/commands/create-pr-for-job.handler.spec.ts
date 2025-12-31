import { Test, TestingModule } from '@nestjs/testing';
import { CreatePRForJobHandler } from './create-pr-for-job.handler';
import { CreatePRForJobCommand } from './create-pr-for-job.command';
import { CompleteJobCommand } from './complete-job.command';
import { AppendJobLogCommand } from './append-job-log.command';
import { SetPRResultCommand } from './set-pr-result.command';
import { JOB_REPOSITORY } from '@/bounded-contexts/job-processing/domain/repositories/job.repository.interface';
import { JobStatus } from '@/bounded-contexts/job-processing/domain/models/job-status.enum';
import { Job } from '@/bounded-contexts/job-processing/domain/models/job.entity';
import { CommandBus, EventBus } from '@nestjs/cqrs';
import { CreatePullRequestCommand } from '@/bounded-contexts/test-generation/application/commands';
import { PRCreatedForJobEvent } from '@/bounded-contexts/job-processing/domain/events';

describe('CreatePRForJobHandler - Lock Release Scenarios', () => {
  let handler: CreatePRForJobHandler;
  let jobRepository: any;
  let commandBus: any;
  let eventBus: any;

  const jobIdStr = 'job-456';
  const repoIdStr = 'repo-456';

  beforeEach(async () => {
    jobRepository = {
      findById: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };

    commandBus = {
      execute: jest.fn().mockImplementation((cmd: any) => {
        // Default mock: handle log commands silently
        if (cmd instanceof AppendJobLogCommand || cmd instanceof SetPRResultCommand) {
          return Promise.resolve();
        }
        return Promise.resolve();
      }),
    };

    eventBus = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatePRForJobHandler,
        { provide: JOB_REPOSITORY, useValue: jobRepository },
        { provide: CommandBus, useValue: commandBus },
        { provide: EventBus, useValue: eventBus },
      ],
    }).compile();

    handler = module.get<CreatePRForJobHandler>(CreatePRForJobHandler);
  });

  // 🔒 CRITICAL: Lock Release Test Cases
  describe('Lock Release - Test Generation Without PR', () => {
    it('should call CompleteJobCommand to release lock when PR creation is not needed', async () => {
      // Arrange: Job that completed test generation but doesn't need PR
      const job = Job.create(repoIdStr, 'src/target.ts');
      job.updateStatus(JobStatus.TEST_GENERATION_COMPLETED);
      job.setCoverageResult({
        totalFiles: 1,
        averageCoverage: 90.0,
        files: [{ file: 'src/target.ts', coverage: 90.0 }],
      });
      job.setTestGenerationResult({
        filePath: 'src/target.ts',
        testFilePath: 'src/target.spec.ts',
        coverage: 95.0,
      });
      // No test generation request ID means PR not needed
      Object.defineProperty(job, 'testGenerationRequestId', { value: undefined });

      jobRepository.findById.mockResolvedValue(job);

      const command = new CreatePRForJobCommand(jobIdStr);

      // Act
      await handler.execute(command);

      // Assert: CompleteJobCommand MUST be called to release the repository lock
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(CompleteJobCommand),
      );

      // Verify the CompleteJobCommand has correct jobId
      const completeJobCall = commandBus.execute.mock.calls.find(
        ([cmd]) => cmd instanceof CompleteJobCommand,
      );
      expect(completeJobCall).toBeDefined();
      expect(completeJobCall[0].jobId).toBe(jobIdStr);

      // Should NOT update status directly (CompleteJobCommand handles it)
      expect(jobRepository.save).not.toHaveBeenCalled();

      // Should NOT call CreatePullRequestCommand
      expect(commandBus.execute).not.toHaveBeenCalledWith(
        expect.any(CreatePullRequestCommand),
      );
    });

    it('should create PR when needed and NOT call CompleteJobCommand', async () => {
      // Arrange: Job that needs PR creation
      const job = Job.create(repoIdStr, 'src/target.ts');
      job.updateStatus(JobStatus.TEST_GENERATION_COMPLETED);
      job.setRepositoryPath('/tmp/repo');
      job.setCoverageResult({
        totalFiles: 1,
        averageCoverage: 50.0,
        files: [{ file: 'src/target.ts', coverage: 50.0 }],
      });
      job.setTestGenerationResult({
        filePath: 'src/target.ts',
        testFilePath: 'src/target.spec.ts',
        coverage: 85.0,
      });
      // Has test generation request ID = needs PR
      Object.defineProperty(job, 'testGenerationRequestId', {
        value: 'tg-req-123',
        writable: true,
        configurable: true
      });
      Object.defineProperty(job, 'sessionId', {
        value: 'session-123',
        writable: true,
        configurable: true
      });

      // Force needsPRCreation to return true
      jest.spyOn(job, 'needsPRCreation').mockReturnValue(true);

      // Handler calls findById twice: once at start, once after SetPRResultCommand
      jobRepository.findById.mockResolvedValue(job);

      // Mock PR creation success and log commands
      commandBus.execute.mockImplementation((cmd: any) => {
        if (cmd instanceof CreatePullRequestCommand) {
          return Promise.resolve({
            pullRequest: {
              url: 'https://github.com/user/repo/pull/1',
              number: 1,
            },
          });
        }
        if (cmd instanceof AppendJobLogCommand || cmd instanceof SetPRResultCommand) {
          return Promise.resolve();
        }
        return Promise.resolve();
      });

      const command = new CreatePRForJobCommand(jobIdStr);

      // Act
      await handler.execute(command);

      // Assert: Should create PR
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(CreatePullRequestCommand),
      );

      // Should NOT call CompleteJobCommand (saga handles it after PRCreatedForJobEvent)
      const completeJobCalls = commandBus.execute.mock.calls.filter(
        ([cmd]) => cmd instanceof CompleteJobCommand,
      );
      expect(completeJobCalls).toHaveLength(0);

      // Should publish PRCreatedForJobEvent
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(PRCreatedForJobEvent),
      );
    });

    it('should handle job not found', async () => {
      // Arrange
      jobRepository.findById.mockResolvedValue(null);

      const command = new CreatePRForJobCommand(jobIdStr);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        `Job ${jobIdStr} not found`,
      );

      // Should call AppendJobLogCommand for error logging, but NOT CompleteJobCommand
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(AppendJobLogCommand),
      );
      expect(commandBus.execute).not.toHaveBeenCalledWith(
        expect.any(CompleteJobCommand),
      );
    });

    it('should handle missing test generation request ID when PR is needed', async () => {
      // Arrange: Inconsistent state - needs PR but no request ID
      const job = Job.create(repoIdStr, 'src/target.ts');
      job.updateStatus(JobStatus.TEST_GENERATION_COMPLETED);
      job.setTestGenerationResult({
        filePath: 'src/target.ts',
        testFilePath: 'src/target.spec.ts',
        coverage: 85.0,
      });

      // Override needsPRCreation to force the scenario where PR is needed
      // but testGenerationRequestId is undefined
      jest.spyOn(job, 'needsPRCreation').mockReturnValue(true);
      Object.defineProperty(job, 'testGenerationRequestId', {
        value: undefined,
        writable: true,
        configurable: true
      });

      jobRepository.findById.mockResolvedValue(job);

      const command = new CreatePRForJobCommand(jobIdStr);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(
        'Cannot create PR: test generation request ID missing',
      );

      // Should NOT call CompleteJobCommand on error
      expect(commandBus.execute).not.toHaveBeenCalledWith(
        expect.any(CompleteJobCommand),
      );
    });
  });

  describe('Full Workflow - PR Creation Success', () => {
    it('should create PR and publish PRCreatedForJobEvent (lock released by saga)', async () => {
      // Arrange
      const job = Job.create(repoIdStr, 'src/target.ts');
      job.updateStatus(JobStatus.TEST_GENERATION_COMPLETED);
      job.setRepositoryPath('/tmp/repo');
      job.setCoverageResult({
        totalFiles: 1,
        averageCoverage: 50.0,
        files: [{ file: 'src/target.ts', coverage: 50.0 }],
      });
      job.setTestGenerationResult({
        filePath: 'src/target.ts',
        testFilePath: 'src/target.spec.ts',
        coverage: 85.0,
      });
      Object.defineProperty(job, 'testGenerationRequestId', {
        value: 'tg-req-123',
        writable: true,
        configurable: true
      });
      Object.defineProperty(job, 'sessionId', {
        value: 'session-123',
        writable: true,
        configurable: true
      });

      // Force needsPRCreation to return true
      jest.spyOn(job, 'needsPRCreation').mockReturnValue(true);

      jobRepository.findById.mockResolvedValue(job);

      const mockPRResult = {
        pullRequest: {
          url: 'https://github.com/user/repo/pull/42',
          number: 42,
        },
      };

      commandBus.execute.mockImplementation((cmd: any) => {
        if (cmd instanceof CreatePullRequestCommand) {
          return Promise.resolve(mockPRResult);
        }
        if (cmd instanceof AppendJobLogCommand || cmd instanceof SetPRResultCommand) {
          return Promise.resolve();
        }
        return Promise.resolve();
      });

      const command = new CreatePRForJobCommand(jobIdStr);

      // Act
      await handler.execute(command);

      // Assert
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(CreatePullRequestCommand),
      );

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(PRCreatedForJobEvent),
      );

      // Verify the event has correct jobId
      const publishedEvent = eventBus.publish.mock.calls[0][0];
      expect(publishedEvent.jobId).toBe(jobIdStr);
      expect(publishedEvent.eventName).toBe('job-processing.pr-created');

      // The saga will listen to PRCreatedForJobEvent and call CompleteJobCommand
      // This handler should NOT call CompleteJobCommand directly
      const completeJobCalls = commandBus.execute.mock.calls.filter(
        ([cmd]) => cmd instanceof CompleteJobCommand,
      );
      expect(completeJobCalls).toHaveLength(0);
    });
  });
});
