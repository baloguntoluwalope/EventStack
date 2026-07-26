export abstract class DomainEvent {
  abstract readonly eventName: string;
  readonly occurredAt: Date = new Date();
  readonly organizationId?: string;

  protected constructor(organizationId?: string) {
    this.organizationId = organizationId;
  }
}