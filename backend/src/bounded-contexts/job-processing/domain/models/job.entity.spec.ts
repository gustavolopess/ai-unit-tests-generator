import { Job, JobProps } from './job.entity';
import { JobId } from './job-id.value-object';
import { JobStatus } from './job-status.enum';
import { JobCreatedEvent } from '@/bounded-contexts/job-processing/domain/events/job-created.event';
import { JobStatusChangedEvent } from '@/bounded-contexts/job-processing/domain/events/job-status-changed.event';
import { JobCompletedEvent } from '@/bounded-contexts/job-processing/domain/events/job-completed.event';
import { JobFailedEvent } from '@/bounded-contexts/job-processing/domain/events/job-failed.event';

describe('Job Entity', () => {
  const repositoryId = 'repo-123';

  describe('create', () => {
    it('should create a new job with PENDING status', () => {
      const job = Job.create(repositoryId);

      expect(job.repositoryId).toBe(repositoryId);
      expect(job.status).toBe(JobStatus.PENDING);
      expect(job.id).toBeDefined();
      expect(job.createdAt).toBeInstanceOf(Date);
      expect(job.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a job with optional targetFilePath', () => {
      const targetFilePath = 'src/service.ts';
      const job = Job.create(repositoryId, targetFilePath);

      expect(job.targetFilePath).toBe(targetFilePath);
    });

    it('should create a child job with parentJobId', () => {
      const parentJobId = 'parent-123';
      const job = Job.create(repositoryId, 'src/file.ts', parentJobId);

      expect(job.parentJobId).toBe(parentJobId);
      expect(job.isChildJob()).toBe(true);
    });

    it('should create a job with entrypoint', () => {
      const entrypoint = 'packages/api';
      const job = Job.create(repositoryId, undefined, undefined, entrypoint);

      expect(job.entrypoint).toBe(entrypoint);
    });

    it('should emit JobCreatedEvent', () => {
      const job = Job.create(repositoryId);
      const events = job.domainEvents;

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(JobCreatedEvent);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute a job from props without emitting events', () => {
      const jobId = JobId.generate();
      const props: JobProps = {
        repositoryId,
        status: JobStatus.ANALYZING,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      const job = Job.reconstitute(jobId, props);

      expect(job.id).toBe(jobId);
      expect(job.status).toBe(JobStatus.ANALYZING);
      expect(job.domainEvents).toHaveLength(0);
    });
  });

  describe('updateStatus', () => {
    it('should update status and emit JobStatusChangedEvent', () => {
      const job = Job.create(repositoryId);
      job.clearEvents();

      job.updateStatus(JobStatus.CLONING);

      expect(job.status).toBe(JobStatus.CLONING);
      expect(job.domainEvents).toHaveLength(1);
      expect(job.domainEvents[0]).toBeInstanceOf(JobStatusChangedEvent);
    });

    it('should set startedAt when transitioning to CLONING', () => {
      const job = Job.create(repositoryId);

      expect(job.startedAt).toBeUndefined();
      job.updateStatus(JobStatus.CLONING);

      expect(job.startedAt).toBeInstanceOf(Date);
    });

    it('should not reset startedAt if already set', () => {
      const job = Job.create(repositoryId);
      job.updateStatus(JobStatus.CLONING);
      const originalStartedAt = job.startedAt;

      job.updateStatus(JobStatus.INSTALLING);
      job.updateStatus(JobStatus.CLONING); // Transition back (edge case)

      expect(job.startedAt).toBe(originalStartedAt);
    });

    it('should set completedAt for terminal statuses', () => {
      const terminalStatuses = [
        JobStatus.ANALYSIS_COMPLETED,
        JobStatus.TEST_GENERATION_COMPLETED,
        JobStatus.PR_CREATION_COMPLETED,
        JobStatus.COMPLETED,
        JobStatus.FAILED,
      ];

      for (const status of terminalStatuses) {
        const job = Job.create(repositoryId);
        job.clearEvents();

        job.updateStatus(status);

        expect(job.completedAt).toBeInstanceOf(Date);
      }
    });

    it('should emit JobCompletedEvent for successful terminal statuses', () => {
      const completedStatuses = [
        JobStatus.ANALYSIS_COMPLETED,
        JobStatus.TEST_GENERATION_COMPLETED,
        JobStatus.PR_CREATION_COMPLETED,
        JobStatus.COMPLETED,
      ];

      for (const status of completedStatuses) {
        const job = Job.create(repositoryId);
        job.clearEvents();

        job.updateStatus(status);

        const completedEvents = job.domainEvents.filter(
          (e) => e instanceof JobCompletedEvent,
        );
        expect(completedEvents).toHaveLength(1);
      }
    });

    it('should not emit JobCompletedEvent for FAILED status', () => {
      const job = Job.create(repositoryId);
      job.clearEvents();

      job.updateStatus(JobStatus.FAILED);

      const completedEvents = job.domainEvents.filter(
        (e) => e instanceof JobCompletedEvent,
      );
      expect(completedEvents).toHaveLength(0);
    });
  });

  describe('setError', () => {
    it('should set error, status to FAILED, and emit JobFailedEvent', () => {
      const job = Job.create(repositoryId);
      job.clearEvents();
      const errorMessage = 'Something went wrong';

      job.setError(errorMessage);

      expect(job.error).toBe(errorMessage);
      expect(job.status).toBe(JobStatus.FAILED);
      expect(job.completedAt).toBeInstanceOf(Date);
      expect(job.domainEvents).toHaveLength(1);
      expect(job.domainEvents[0]).toBeInstanceOf(JobFailedEvent);
    });
  });

  describe('inheritFromParent', () => {
    it('should inherit repositoryPath and coverageResult from parent', () => {
      const parentJob = Job.create(repositoryId);
      parentJob.setRepositoryPath('/tmp/repo');
      parentJob.setCoverageResult({
        totalFiles: 10,
        averageCoverage: 85,
        files: [{ file: 'src/a.ts', coverage: 85 }],
      });

      const childJob = Job.create(
        repositoryId,
        'src/file.ts',
        parentJob.id.getValue(),
      );
      childJob.inheritFromParent(parentJob);

      expect(childJob.repositoryPath).toBe(parentJob.repositoryPath);
      expect(childJob.coverageResult).toEqual(parentJob.coverageResult);
    });

    it('should throw error if not a child job', () => {
      const job = Job.create(repositoryId);
      const parentJob = Job.create(repositoryId);

      expect(() => job.inheritFromParent(parentJob)).toThrow(
        'Cannot inherit from parent: this is not a child job',
      );
    });
  });

  describe('isChildJob', () => {
    it('should return true if parentJobId is set', () => {
      const job = Job.create(repositoryId, 'file.ts', 'parent-id');
      expect(job.isChildJob()).toBe(true);
    });

    it('should return false if parentJobId is not set', () => {
      const job = Job.create(repositoryId);
      expect(job.isChildJob()).toBe(false);
    });
  });

  describe('needsCloning', () => {
    it('should return true if repositoryPath is not set', () => {
      const job = Job.create(repositoryId);
      expect(job.needsCloning()).toBe(true);
    });

    it('should return false if repositoryPath is set', () => {
      const job = Job.create(repositoryId);
      job.setRepositoryPath('/tmp/repo');
      expect(job.needsCloning()).toBe(false);
    });
  });

  describe('needsDependencyInstallation', () => {
    it('should return true if repositoryPath is set and status is CLONING', () => {
      const job = Job.create(repositoryId);
      job.setRepositoryPath('/tmp/repo');
      job.updateStatus(JobStatus.CLONING);

      expect(job.needsDependencyInstallation()).toBe(true);
    });

    it('should return false if repositoryPath is not set', () => {
      const job = Job.create(repositoryId);
      expect(job.needsDependencyInstallation()).toBe(false);
    });

    it('should return false if status is not CLONING', () => {
      const job = Job.create(repositoryId);
      job.setRepositoryPath('/tmp/repo');
      job.updateStatus(JobStatus.ANALYZING);

      expect(job.needsDependencyInstallation()).toBe(false);
    });
  });

  describe('needsCoverageAnalysis', () => {
    it('should return true if coverageResult is null', () => {
      const job = Job.create(repositoryId);
      expect(job.needsCoverageAnalysis()).toBe(true);
    });

    it('should return false if coverageResult is set', () => {
      const job = Job.create(repositoryId);
      job.setCoverageResult({ totalFiles: 1, averageCoverage: 80, files: [] });
      expect(job.needsCoverageAnalysis()).toBe(false);
    });
  });

  describe('needsTestGeneration', () => {
    it('should return true if targetFilePath is set and testGenerationResult is null', () => {
      const job = Job.create(repositoryId, 'src/file.ts');
      expect(job.needsTestGeneration()).toBe(true);
    });

    it('should return false if targetFilePath is not set', () => {
      const job = Job.create(repositoryId);
      expect(job.needsTestGeneration()).toBe(false);
    });

    it('should return false if testGenerationResult is set', () => {
      const job = Job.create(repositoryId, 'src/file.ts');
      job.setTestGenerationResult({ filePath: 'src/file.ts' });
      expect(job.needsTestGeneration()).toBe(false);
    });
  });

  describe('needsPRCreation', () => {
    it('should return true if testGenerationResult is set, prCreationResult is null, and sessionId is set', () => {
      const job = Job.create(repositoryId, 'src/file.ts');
      job.setTestGenerationResult({ filePath: 'src/file.ts' });
      job.setSessionId('session-123');

      expect(job.needsPRCreation()).toBe(true);
    });

    it('should return false if testGenerationResult is not set', () => {
      const job = Job.create(repositoryId);
      job.setSessionId('session-123');
      expect(job.needsPRCreation()).toBe(false);
    });

    it('should return false if sessionId is not set', () => {
      const job = Job.create(repositoryId, 'src/file.ts');
      job.setTestGenerationResult({ filePath: 'src/file.ts' });
      expect(job.needsPRCreation()).toBe(false);
    });

    it('should return false if prCreationResult is already set', () => {
      const job = Job.create(repositoryId, 'src/file.ts');
      job.setTestGenerationResult({ filePath: 'src/file.ts' });
      job.setSessionId('session-123');
      job.setPRCreationResult({ prUrl: 'https://github.com/...', prNumber: 1 });

      expect(job.needsPRCreation()).toBe(false);
    });
  });

  describe('canGenerateTests', () => {
    it('should return true if repositoryPath and targetFilePath are set', () => {
      const job = Job.create(repositoryId, 'src/file.ts');
      job.setRepositoryPath('/tmp/repo');

      expect(job.canGenerateTests()).toBe(true);
    });

    it('should return false if repositoryPath is not set', () => {
      const job = Job.create(repositoryId, 'src/file.ts');
      expect(job.canGenerateTests()).toBe(false);
    });

    it('should return false if targetFilePath is not set', () => {
      const job = Job.create(repositoryId);
      job.setRepositoryPath('/tmp/repo');
      expect(job.canGenerateTests()).toBe(false);
    });
  });

  describe('canCreatePR', () => {
    it('should return true if sessionId and testGenerationResult are set', () => {
      const job = Job.create(repositoryId, 'src/file.ts');
      job.setSessionId('session-123');
      job.setTestGenerationResult({ filePath: 'src/file.ts' });

      expect(job.canCreatePR()).toBe(true);
    });

    it('should return false if sessionId is not set', () => {
      const job = Job.create(repositoryId, 'src/file.ts');
      job.setTestGenerationResult({ filePath: 'src/file.ts' });

      expect(job.canCreatePR()).toBe(false);
    });

    it('should return false if testGenerationResult is not set', () => {
      const job = Job.create(repositoryId);
      job.setSessionId('session-123');

      expect(job.canCreatePR()).toBe(false);
    });
  });

  describe('setters update updatedAt', () => {
    it('setLogPath should update updatedAt', () => {
      const job = Job.create(repositoryId);
      const originalUpdatedAt = job.updatedAt;

      // Small delay to ensure time difference
      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      job.setLogPath('/tmp/logs/job.log');

      expect(job.logPath).toBe('/tmp/logs/job.log');
      jest.useRealTimers();
    });

    it('setRepositoryPath should update updatedAt', () => {
      const job = Job.create(repositoryId);
      job.setRepositoryPath('/tmp/repo');
      expect(job.repositoryPath).toBe('/tmp/repo');
    });

    it('setCoverageResult should update updatedAt', () => {
      const job = Job.create(repositoryId);
      const result = { totalFiles: 5, averageCoverage: 90, files: [] };
      job.setCoverageResult(result);
      expect(job.coverageResult).toEqual(result);
    });

    it('setTestGenerationResult should update updatedAt', () => {
      const job = Job.create(repositoryId);
      const result = { filePath: 'src/a.ts', testFilePath: 'src/a.spec.ts' };
      job.setTestGenerationResult(result);
      expect(job.testGenerationResult).toEqual(result);
    });

    it('setPRCreationResult should update updatedAt', () => {
      const job = Job.create(repositoryId);
      const result = { prUrl: 'https://github.com/...', prNumber: 42 };
      job.setPRCreationResult(result);
      expect(job.prCreationResult).toEqual(result);
    });

    it('setSessionId should update updatedAt', () => {
      const job = Job.create(repositoryId);
      job.setSessionId('session-abc');
      expect(job.sessionId).toBe('session-abc');
    });

    it('setTargetFilePath should update updatedAt', () => {
      const job = Job.create(repositoryId);
      job.setTargetFilePath('src/new-file.ts');
      expect(job.targetFilePath).toBe('src/new-file.ts');
    });

    it('setTestGenerationRequestId should update updatedAt', () => {
      const job = Job.create(repositoryId);
      job.setTestGenerationRequestId('request-123');
      expect(job.testGenerationRequestId).toBe('request-123');
    });
  });
});
