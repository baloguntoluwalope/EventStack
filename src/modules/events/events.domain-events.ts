import { DomainEvent } from '../../infrastructure/events/domain-event.base';

/**
 * Emitted when an event is published. Analytics, Notifications, and future
 * listeners (search indexing, webhooks) subscribe independently — this
 * module never enumerates or knows about its listeners.
 */
export class EventPublishedDomainEvent extends DomainEvent {
  readonly eventName = 'event.published';

  constructor(
    public readonly organizationId: string,
    public readonly eventId: string,
    public readonly title: string,
    public readonly slug: string,
    public readonly publishedByUserId: string,
  ) {
    super(organizationId);
  }
}