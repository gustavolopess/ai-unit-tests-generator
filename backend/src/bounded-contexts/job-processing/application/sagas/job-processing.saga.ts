import { Injectable, Logger } from '@nestjs/common';
import { ICommand, ofType, Saga } from '@nestjs/cqrs';
import { Observable } from 'rxjs';
import { delay, map } from 'rxjs/operators';
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
} from '../../domain/events';
import {
  SetRepositoryPathForJobCommand,
  InstallDependenciesCommand,
  AnalyzeCoverageForJobCommand,
  GenerateTestsForJobCommand,
  CreatePRForJobCommand,
  CompleteJobCommand,
  FailJobCommand,
} from '../commands';

/**
 * Job Processing Saga
 *
 * This saga orchestrates the entire job processing workflow by listening to domain events
 * and issuing commands to the appropriate bounded contexts.
 *
 * Workflow:
 * 1. Job Created → Set Repository Path
 * 2. Repository Path Set → Install Dependencies
 * 3. Dependencies Installed → Analyze Coverage
 * 4. Coverage Analysis Completed → Generate Tests (if needed)
 * 5. Test Generation Completed → Create PR (if needed)
 * 6. PR Created / No Further Steps → Complete Job
 * 7. Any Failure → Fail Job
 */
@Injectable()
export class JobProcessingSaga {
  private readonly logger = new Logger(JobProcessingSaga.name);

  /**
   * When a job is created, set the repository path first
   */
  @Saga()
  jobCreated = (events$: Observable<any>): Observable<ICommand> => {
    return events$.pipe(
      ofType(JobCreatedEvent),
      delay(100), // Small delay to ensure job is persisted
      map((event: JobCreatedEvent) => {
        this.logger.log(`Saga: Job created ${event.jobId}, setting repository path`);
        return new SetRepositoryPathForJobCommand(event.jobId.getValue());
      }),
    );
  };

  /**
   * When repository path is set, proceed to install dependencies
   */
  @Saga()
  repositoryPathSet = (events$: Observable<any>): Observable<ICommand> => {
    return events$.pipe(
      ofType(RepositoryPathSetEvent),
      map((event: RepositoryPathSetEvent) => {
        this.logger.log(`Saga: Repository path set for job ${event.jobId}, starting dependency installation`);
        return new InstallDependenciesCommand(event.jobId);
      }),
    );
  };

  /**
   * When dependencies are installed, proceed to coverage analysis
   */
  @Saga()
  dependenciesInstalled = (events$: Observable<any>): Observable<ICommand> => {
    return events$.pipe(
      ofType(DependenciesInstalledEvent),
      map((event: DependenciesInstalledEvent) => {
        this.logger.log(`Saga: Dependencies installed for job ${event.jobId}, starting coverage analysis`);
        return new AnalyzeCoverageForJobCommand(event.jobId);
      }),
    );
  };

  /**
   * When coverage analysis completes, check if test generation is needed
   */
  @Saga()
  coverageAnalysisCompleted = (events$: Observable<any>): Observable<ICommand> => {
    return events$.pipe(
      ofType(CoverageAnalysisCompletedForJobEvent),
      map((event: CoverageAnalysisCompletedForJobEvent) => {
        this.logger.log(`Saga: Coverage analysis completed for job ${event.jobId}`);
        // The command handler will check if the job needs test generation
        return new GenerateTestsForJobCommand(event.jobId);
      }),
    );
  };

  /**
   * When test generation completes, check if PR creation is needed
   */
  @Saga()
  testGenerationCompleted = (events$: Observable<any>): Observable<ICommand> => {
    return events$.pipe(
      ofType(TestGenerationCompletedForJobEvent),
      map((event: TestGenerationCompletedForJobEvent) => {
        this.logger.log(`Saga: Test generation completed for job ${event.jobId}, checking if PR creation needed`);
        return new CreatePRForJobCommand(event.jobId);
      }),
    );
  };

  /**
   * When PR is created, complete the job
   */
  @Saga()
  prCreated = (events$: Observable<any>): Observable<ICommand> => {
    return events$.pipe(
      ofType(PRCreatedForJobEvent),
      map((event: PRCreatedForJobEvent) => {
        this.logger.log(`Saga: PR created for job ${event.jobId}, completing job`);
        return new CompleteJobCommand(event.jobId);
      }),
    );
  };

  /**
   * Handle coverage analysis failures
   */
  @Saga()
  coverageAnalysisFailed = (events$: Observable<any>): Observable<ICommand> => {
    return events$.pipe(
      ofType(CoverageAnalysisFailedForJobEvent),
      map((event: CoverageAnalysisFailedForJobEvent) => {
        this.logger.error(`Saga: Coverage analysis failed for job ${event.jobId}: ${event.error}`);
        return new FailJobCommand(event.jobId, event.error);
      }),
    );
  };

  /**
   * Handle test generation failures
   */
  @Saga()
  testGenerationFailed = (events$: Observable<any>): Observable<ICommand> => {
    return events$.pipe(
      ofType(TestGenerationFailedForJobEvent),
      map((event: TestGenerationFailedForJobEvent) => {
        this.logger.error(`Saga: Test generation failed for job ${event.jobId}: ${event.error}`);
        return new FailJobCommand(event.jobId, event.error);
      }),
    );
  };

  /**
   * Handle PR creation failures
   */
  @Saga()
  prCreationFailed = (events$: Observable<any>): Observable<ICommand> => {
    return events$.pipe(
      ofType(PRCreationFailedForJobEvent),
      map((event: PRCreationFailedForJobEvent) => {
        this.logger.error(`Saga: PR creation failed for job ${event.jobId}: ${event.error}`);
        return new FailJobCommand(event.jobId, event.error);
      }),
    );
  };
}
