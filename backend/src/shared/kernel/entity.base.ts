import { IDomainEvent } from './domain-event.interface';

export abstract class Entity<T> {
  protected readonly _id: T;
  private _domainEvents: IDomainEvent[] = [];

  constructor(id: T) {
    this._id = id;
  }

  get id(): T {
    return this._id;
  }

  get domainEvents(): IDomainEvent[] {
    return [...this._domainEvents];
  }

  protected addDomainEvent(event: IDomainEvent): void {
    this._domainEvents.push(event);
  }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  public equals(other: Entity<T>): boolean {
    if (other === null || other === undefined) {
      return false;
    }

    if (this === other) {
      return true;
    }

    return this._id === other._id;
  }
}

export abstract class AggregateRoot<T> extends Entity<T> {
  protected apply(event: IDomainEvent): void {
    this.addDomainEvent(event);
  }
}
