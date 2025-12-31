import { Test, TestingModule } from '@nestjs/testing';
import { GenerateTestsForJobHandler } from './generate-tests-for-job.handler';
import { GenerateTestsForJobCommand } from './generate-tests-for-job.command';
import { JOB_REPOSITORY } from '@/bounded-contexts/job-processing/domain/repositories/job.repository.interface';
import { JobStatus } from '@/bounded-contexts/job-processing/domain/models/job-status.enum';
import { Job } from '@/bounded-contexts/job-processing/domain/models/job.entity';
import { CommandBus, QueryBus, EventBus } from '@nestjs/cqrs';
import { GenerateTestsCommand } from '@/bounded-contexts/test-generation/application/commands';
import { GetRepositoryQuery } from '@/bounded-contexts/git-repo-analysis/application/queries';
import { SetTestGenerationDataCommand } from './set-test-generation-data.command';
import {
  TestGenerationCompletedForJobEvent,
  TestGenerationFailedForJobEvent,
} from '@/bounded-contexts/job-processing/domain/events';

describe('GenerateTestsForJobHandler', () => {
  let handler: GenerateTestsForJobHandler;
  let jobRepository: any;
  let commandBus: any;
  let queryBus: any;
  let eventBus: any;

  const jobIdStr = 'job-123';
  const repoIdStr = 'repo-123';

  beforeEach(async () => {
    jobRepository = {
      findById: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };

    commandBus = {
      execute: jest.fn(),
    };

    queryBus = {
      execute: jest.fn(),
    };

    eventBus = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenerateTestsForJobHandler,
        { provide: JOB_REPOSITORY, useValue: jobRepository },
        { provide: CommandBus, useValue: commandBus },
        { provide: QueryBus, useValue: queryBus },
        { provide: EventBus, useValue: eventBus },
      ],
    }).compile();

    handler = module.get<GenerateTestsForJobHandler>(
      GenerateTestsForJobHandler,
    );
  });

  it('should generate tests successfully', async () => {
    // Setup job
    const job = Job.create(repoIdStr, 'src/target.ts');
    Object.defineProperty(job, 'id', { value: { getValue: () => jobIdStr } });
    job.updateStatus(JobStatus.ANALYSIS_COMPLETED); // Ready for test generation
    job.setCoverageResult({
      totalFiles: 1,
      averageCoverage: 50.0,
      files: [{ file: 'src/target.ts', coverage: 50.0 }],
    }); // Low coverage needs tests
    job.setRepositoryPath('/tmp/repo');

    jobRepository.findById.mockResolvedValue(job);

    // Setup repo query
    queryBus.execute.mockImplementation((query) => {
      if (query instanceof GetRepositoryQuery) {
        return { url: { getValue: () => 'https://github.com/a/b.git' } };
      }
    });

    // Setup test generation result
    commandBus.execute.mockImplementation((command) => {
      if (command instanceof GenerateTestsCommand) {
        return {
          id: { getValue: () => 'req-123' },
          sessionId: 'session-123',
          testFilePath: 'src/target.spec.ts',
          coverage: 85,
        };
      }
      return Promise.resolve();
    });

    const command = new GenerateTestsForJobCommand(jobIdStr);
    await handler.execute(command);

    // Verify job status updates
    expect(jobRepository.save).toHaveBeenCalledTimes(2); // GENERATING_TESTS, then TEST_GENERATION_COMPLETED

    // Verify buses
    expect(queryBus.execute).toHaveBeenCalledWith(
      expect.any(GetRepositoryQuery),
    );
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.any(GenerateTestsCommand),
    );
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.any(SetTestGenerationDataCommand),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(TestGenerationCompletedForJobEvent),
    );
  });

  it('should skip if test generation already completed', async () => {
    const job = Job.create(repoIdStr, 'src/target.ts');
    job.updateStatus(JobStatus.ANALYSIS_COMPLETED);
    job.setCoverageResult({
      totalFiles: 1,
      averageCoverage: 95.0,
      files: [{ file: 'src/target.ts', coverage: 95.0 }],
    });
    job.setTestGenerationResult({
      filePath: 'src/target.ts',
      testFilePath: 'src/target.spec.ts',
      coverage: 95.0,
    });

    jobRepository.findById.mockResolvedValue(job);

    const command = new GenerateTestsForJobCommand(jobIdStr);
    await handler.execute(command);

    expect(commandBus.execute).not.toHaveBeenCalledWith(
      expect.any(GenerateTestsCommand),
    );
    // Should complete the job directly if PR not needed (PR logic depends on other flags)
    expect(job.status).toBe(JobStatus.COMPLETED);
    expect(jobRepository.save).toHaveBeenCalled();
  });

  it('should handle failures', async () => {
    const job = Job.create(repoIdStr, 'src/target.ts');
    job.updateStatus(JobStatus.ANALYSIS_COMPLETED);
    job.setCoverageResult({
      totalFiles: 1,
      averageCoverage: 50.0,
      files: [{ file: 'src/target.ts', coverage: 50.0 }],
    });
    job.setRepositoryPath('/tmp/repo');

    jobRepository.findById.mockResolvedValue(job);

    // Mock query failure
    queryBus.execute.mockRejectedValue(new Error('Query failed'));

    const command = new GenerateTestsForJobCommand(jobIdStr);

    await expect(handler.execute(command)).rejects.toThrow('Query failed');

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(TestGenerationFailedForJobEvent),
    );
  });
});
