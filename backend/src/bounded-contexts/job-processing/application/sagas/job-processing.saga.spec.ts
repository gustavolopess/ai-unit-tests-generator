import { Test, TestingModule } from '@nestjs/testing';
import { JobProcessingSaga } from './job-processing.saga';
import { of } from 'rxjs';
import { JobId } from '@/bounded-contexts/job-processing/domain/models/job-id.value-object';
import {
  JobCreatedEvent,
  JobCompletedEvent,
  JobFailedEvent,
  RepositoryPathSetEvent,
  DependenciesInstalledEvent,
  CoverageAnalysisCompletedForJobEvent,
  CoverageAnalysisFailedForJobEvent,
  TestGenerationCompletedForJobEvent,
  TestGenerationFailedForJobEvent,
  PRCreatedForJobEvent,
  PRCreationFailedForJobEvent,
} from '@/bounded-contexts/job-processing/domain/events';
import {
  SetRepositoryPathForJobCommand,
  InstallDependenciesCommand,
  AnalyzeCoverageForJobCommand,
  GenerateTestsForJobCommand,
  CreatePRForJobCommand,
  CompleteJobCommand,
  FailJobCommand,
} from '@/bounded-contexts/job-processing/application/commands';

describe('JobProcessingSaga', () => {
  let saga: JobProcessingSaga;
  const jobIdStr = 'job-123';
  const jobId = JobId.create(jobIdStr);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JobProcessingSaga],
    }).compile();

    saga = module.get<JobProcessingSaga>(JobProcessingSaga);
  });

  describe('jobCreated', () => {
    it('should map JobCreatedEvent to SetRepositoryPathForJobCommand', (done) => {
      const event = new JobCreatedEvent(jobId, 'repo-123');

      saga.jobCreated(of(event)).subscribe((command) => {
        expect(command).toBeInstanceOf(SetRepositoryPathForJobCommand);
        expect((command as SetRepositoryPathForJobCommand).jobId).toBe(
          jobIdStr,
        );
        done();
      });
    });
  });

  describe('repositoryPathSet', () => {
    it('should map RepositoryPathSetEvent to InstallDependenciesCommand', (done) => {
      const event = new RepositoryPathSetEvent(jobIdStr);

      saga.repositoryPathSet(of(event)).subscribe((command) => {
        expect(command).toBeInstanceOf(InstallDependenciesCommand);
        expect((command as InstallDependenciesCommand).jobId).toBe(jobIdStr);
        done();
      });
    });
  });

  describe('dependenciesInstalled', () => {
    it('should map DependenciesInstalledEvent to AnalyzeCoverageForJobCommand', (done) => {
      const event = new DependenciesInstalledEvent(jobIdStr, '/tmp/repo');

      saga.dependenciesInstalled(of(event)).subscribe((command) => {
        expect(command).toBeInstanceOf(AnalyzeCoverageForJobCommand);
        expect((command as AnalyzeCoverageForJobCommand).jobId).toBe(jobIdStr);
        done();
      });
    });
  });

  describe('coverageAnalysisCompleted', () => {
    it('should map CoverageAnalysisCompletedForJobEvent to GenerateTestsForJobCommand', (done) => {
      const event = new CoverageAnalysisCompletedForJobEvent(jobIdStr);

      saga.coverageAnalysisCompleted(of(event)).subscribe((command) => {
        expect(command).toBeInstanceOf(GenerateTestsForJobCommand);
        expect((command as GenerateTestsForJobCommand).jobId).toBe(jobIdStr);
        done();
      });
    });
  });

  describe('testGenerationCompleted', () => {
    it('should map TestGenerationCompletedForJobEvent to CreatePRForJobCommand', (done) => {
      const event = new TestGenerationCompletedForJobEvent(jobIdStr);

      saga.testGenerationCompleted(of(event)).subscribe((command) => {
        expect(command).toBeInstanceOf(CreatePRForJobCommand);
        expect((command as CreatePRForJobCommand).jobId).toBe(jobIdStr);
        done();
      });
    });
  });

  describe('prCreated', () => {
    it('should map PRCreatedForJobEvent to CompleteJobCommand', (done) => {
      const event = new PRCreatedForJobEvent(jobIdStr);

      saga.prCreated(of(event)).subscribe((command) => {
        expect(command).toBeInstanceOf(CompleteJobCommand);
        expect((command as CompleteJobCommand).jobId).toBe(jobIdStr);
        done();
      });
    });
  });

  describe('failure scenarios', () => {
    it('should map CoverageAnalysisFailedForJobEvent to FailJobCommand', (done) => {
      const error = 'Analysis failed';
      const event = new CoverageAnalysisFailedForJobEvent(jobIdStr, error);

      saga.coverageAnalysisFailed(of(event)).subscribe((command) => {
        expect(command).toBeInstanceOf(FailJobCommand);
        expect((command as FailJobCommand).jobId).toBe(jobIdStr);
        expect((command as FailJobCommand).error).toBe(error);
        done();
      });
    });

    it('should map TestGenerationFailedForJobEvent to FailJobCommand', (done) => {
      const error = 'Generation failed';
      const event = new TestGenerationFailedForJobEvent(jobIdStr, error);

      saga.testGenerationFailed(of(event)).subscribe((command) => {
        expect(command).toBeInstanceOf(FailJobCommand);
        expect((command as FailJobCommand).jobId).toBe(jobIdStr);
        expect((command as FailJobCommand).error).toBe(error);
        done();
      });
    });

    it('should map PRCreationFailedForJobEvent to FailJobCommand', (done) => {
      const error = 'PR creation failed';
      const event = new PRCreationFailedForJobEvent(jobIdStr, error);

      saga.prCreationFailed(of(event)).subscribe((command) => {
        expect(command).toBeInstanceOf(FailJobCommand);
        expect((command as FailJobCommand).jobId).toBe(jobIdStr);
        expect((command as FailJobCommand).error).toBe(error);
        done();
      });
    });
  });
});
