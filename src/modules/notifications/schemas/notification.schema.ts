import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity } from '../../../common/base/base-entity.schema';

export enum NotificationChannel { IN_APP = 'in_app', EMAIL = 'email', SMS = 'sms', PUSH = 'push' }
export enum NotificationType {
  WELCOME = 'welcome',
  EVENT_PUBLISHED = 'event_published',
  EVENT_UPDATED = 'event_updated',
  MEDIA_UPLOADED = 'media_uploaded',
  MEMBER_INVITED = 'member_invited',
}

@Schema({ timestamps: true })
export class Notification extends BaseEntity {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ enum: NotificationChannel, default: NotificationChannel.IN_APP })
  channel: NotificationChannel;

  @Prop({ enum: NotificationType, required: true })
  type: NotificationType;

  @Prop()
  message: string;

  @Prop({ default: false })
  read: boolean;
}
export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);