import { CommandHandler, ICommandHandler, CommandBus, EventBus } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { CreatePRForJobCommand } from './create-pr-for-job.command';
import type { IJobRepository } from '../../domain/repositories/job.repository.interface';
import { JOB_REPOSITORY } from '../../domain/repositories/job.repository.interface';
import { JobStatus } from '../../domain/models/job-status.enum';
import { CreatePullRequestCommand } from '../../../test-generation/application/commands';
import { AppendJobLogCommand, SetPRResultCommand } from './';
import { PRCreatedForJobEvent, PRCreationFailedForJobEvent } from '../../domain/events';

@CommandHandler(CreatePRForJobCommand)
export class CreatePRForJobHandler
  implements ICommandHandler<CreatePRForJobCommand>
{
  private readonly logger = new Logger(CreatePRForJobHandler.name);

  constructor(
    @Inject(JOB_REPOSITORY)
    private readonly jobRepository: IJobRepository,
    private readonly commandBus: CommandBus,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreatePRForJobCommand): Promise<void> {
    const { jobId } = command;

    this.logger.log(`Checking if PR creation needed for job ${jobId}`);

    try {
      // Get job
      const job = await this.jobRepository.findById(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      // Check if PR creation is needed
      if (!job.needsPRCreation()) {
        this.logger.log(`Job ${jobId} does not need PR creation, completing job`);
        job.updateStatus(JobStatus.COMPLETED);
        await this.jobRepository.save(job);
        return;
      }

      if (!job.testGenerationRequestId) {
        throw new Error('Cannot create PR: test generation request ID missing');
      }

      // Update status
      job.updateStatus(JobStatus.CREATING_PR);
      await this.jobRepository.save(job);

      // Log
      await this.commandBus.execute(
        new AppendJobLogCommand(
          jobId,
          `Creating pull request using session ${job.sessionId}...`,
        ),
      );

      // Execute PR creation
      const prResult = await this.commandBus.execute(
        new CreatePullRequestCommand(
          job.testGenerationRequestId,
          async (output: string) => {
            await this.commandBus.execute(new AppendJobLogCommand(jobId, output));
          },
        ),
      );

      await this.commandBus.execute(
        new AppendJobLogCommand(
          jobId,
          `Pull request created successfully: ${prResult.pullRequest!.url}`,
        ),
      );

      // Save PR result
      await this.commandBus.execute(
        new SetPRResultCommand(jobId, {
          prUrl: prResult.pullRequest!.url,
          prNumber: prResult.pullRequest!.number,
        }),
      );

      // Update job status
      job.updateStatus(JobStatus.PR_CREATION_COMPLETED);
      await this.jobRepository.save(job);

      this.logger.log(`PR creation completed for job ${jobId}`);

      // Publish event to trigger next step in saga
      this.eventBus.publish(new PRCreatedForJobEvent(jobId));
    } catch (error) {
      this.logger.error(`Failed to create PR for job ${jobId}: ${error.message}`);
      await this.commandBus.execute(
        new AppendJobLogCommand(jobId, `ERROR: ${error.message}`),
      );

      // Publish failure event to trigger saga error handling
      this.eventBus.publish(new PRCreationFailedForJobEvent(jobId, error.message));
      throw error;
    }
  }
}
