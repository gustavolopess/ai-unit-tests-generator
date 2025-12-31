import { IDomainEvent } from '@/shared/kernel/domain-event.interface';

export class RepositoryPathSetEvent implements IDomainEvent {
  readonly eventName = 'job-processing.repository-path-set';
  readonly occurredOn: Date;

  constructor(public readonly jobId: string) {
    this.occurredOn = new Date();
  }
}
