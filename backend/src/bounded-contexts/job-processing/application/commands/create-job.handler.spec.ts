import { Test, TestingModule } from '@nestjs/testing';
import { CreateJobHandler } from './create-job.handler';
import { CreateJobCommand } from './create-job.command';
import { JOB_REPOSITORY } from '@/bounded-contexts/job-processing/domain/repositories/job.repository.interface';
import { Job } from '@/bounded-contexts/job-processing/domain/models/job.entity';
import { JobId } from '@/bounded-contexts/job-processing/domain/models/job-id.value-object';

describe('CreateJobHandler', () => {
  let handler: CreateJobHandler;
  let jobRepository: any;

  const repositoryId = 'repo-123';
  const jobIdStr = 'job-123';
  const jobId = JobId.create(jobIdStr);

  beforeEach(async () => {
    jobRepository = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateJobHandler,
        {
          provide: JOB_REPOSITORY,
          useValue: jobRepository,
        },
      ],
    }).compile();

    handler = module.get<CreateJobHandler>(CreateJobHandler);
  });

  it('should create and save a new job', async () => {
    const command = new CreateJobCommand(repositoryId, 'src/test.ts');

    const job = await handler.execute(command);

    expect(job).toBeInstanceOf(Job);
    expect(job.repositoryId).toBe(repositoryId);
    expect(job.targetFilePath).toBe('src/test.ts');
    expect(job.isChildJob()).toBe(false);

    expect(jobRepository.save).toHaveBeenCalledWith(job);
    expect(jobRepository.findById).not.toHaveBeenCalled();
  });

  it('should inherit from parent job if parentJobId is provided', async () => {
    const parentJobId = 'parent-123';
    const parentJob = Job.create(repositoryId);
    parentJob.setRepositoryPath('/tmp/repo');

    jobRepository.findById.mockResolvedValue(parentJob);

    const command = new CreateJobCommand(
      repositoryId,
      'src/child.ts',
      parentJobId,
    );
    const job = await handler.execute(command);

    expect(job.isChildJob()).toBe(true);
    expect(job.parentJobId).toBe(parentJobId);
    // Should verify inheritance happened (logic inside inheritFromParent is tested in entity spec)
    // But we can check if inheritFromParent was called if we mock the entity,
    // or just check the side effect which is repositoryPath being set.
    expect(job.repositoryPath).toBe('/tmp/repo');

    expect(jobRepository.findById).toHaveBeenCalledWith(parentJobId);
    expect(jobRepository.save).toHaveBeenCalledWith(job);
  });

  it('should throw error if parent job not found', async () => {
    const parentJobId = 'missing-parent';
    jobRepository.findById.mockResolvedValue(null);

    const command = new CreateJobCommand(
      repositoryId,
      'src/child.ts',
      parentJobId,
    );

    await expect(handler.execute(command)).rejects.toThrow(
      `Parent job ${parentJobId} not found`,
    );
  });

  it('should set entrypoint if provided', async () => {
    const entrypoint = 'packages/api';
    const command = new CreateJobCommand(
      repositoryId,
      undefined,
      undefined,
      entrypoint,
    );

    const job = await handler.execute(command);

    expect(job.entrypoint).toBe(entrypoint);
  });
});
