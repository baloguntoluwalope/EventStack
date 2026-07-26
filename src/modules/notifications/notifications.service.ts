import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

// Separate value import from interface type import
import { NOTIFICATION_REPOSITORY } from './interfaces/notification-repository.interface';
import type { INotificationRepository } from './interfaces/notification-repository.interface';

import { NotificationType } from './schemas/notification.schema';
import { assertFound } from '../../common/utils/assert-found.util';
import { EventPublishedDomainEvent } from '../events/events.domain-events';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private notificationRepo: INotificationRepository,
  ) {}

  notify(organizationId: string, userId: string, type: NotificationType, message: string) {
    return this.notificationRepo.create({
      organizationId: organizationId as any,
      userId: userId as any,
      type,
      message,
    });
  }

  @OnEvent('event.published')
  async handleEventPublished(payload: EventPublishedDomainEvent) {
    if (!payload.organizationId) return;

    await this.notify(
      payload.organizationId,
      payload.publishedByUserId,
      NotificationType.EVENT_PUBLISHED,
      `"${payload.title}" has been published.`,
    );
  }

  listForUser(userId: string, unreadOnly?: boolean) {
    return this.notificationRepo.findByUser(userId, unreadOnly);
  }

  async markRead(id: string) {
    return assertFound(await this.notificationRepo.markRead(id), 'Notification not found');
  }
}