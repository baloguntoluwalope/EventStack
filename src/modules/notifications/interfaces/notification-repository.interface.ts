import { NotificationDocument } from '../schemas/notification.schema';

export interface INotificationRepository {
  create(data: Partial<NotificationDocument>): Promise<NotificationDocument>;
  findByUser(userId: string, unreadOnly?: boolean): Promise<NotificationDocument[]>;
  markRead(id: string): Promise<NotificationDocument | null>;
}

export const NOTIFICATION_REPOSITORY = 'NOTIFICATION_REPOSITORY';