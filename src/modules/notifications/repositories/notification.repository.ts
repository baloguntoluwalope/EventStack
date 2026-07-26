import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseMongooseRepository } from '../../../common/base/base-mongoose.repository';
import { Notification, NotificationDocument } from '../schemas/notification.schema';
import { INotificationRepository } from '../interfaces/notification-repository.interface';

@Injectable()
export class MongooseNotificationRepository
  extends BaseMongooseRepository<NotificationDocument>
  implements INotificationRepository
{
  constructor(@InjectModel(Notification.name) model: Model<NotificationDocument>) {
    super(model);
  }

  findByUser(userId: string, unreadOnly = false) {
    const filter: any = { userId, deletedAt: null };
    if (unreadOnly) filter.read = false;
    return this.model.find(filter).sort({ createdAt: -1 }).exec();
  }

  markRead(id: string) {
    return this.model.findByIdAndUpdate(id, { read: true }, { new: true }).exec();
  }
}