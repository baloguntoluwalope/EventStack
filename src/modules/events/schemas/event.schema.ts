import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity } from '../../../common/base/base-entity.schema';
import { EventStatus } from '../../../common/constants/event-status.constants';

@Schema({ timestamps: true })
export class Event extends BaseEntity {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop()
  category: string;

  @Prop({ type: String, enum: EventStatus, default: EventStatus.DRAFT })
  status: EventStatus;

  @Prop({ type: Types.ObjectId, ref: 'Template' })
  templateId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Theme' })
  themeId?: Types.ObjectId;

  @Prop()
  qrCodeUrl?: string;

  @Prop()
  publishedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop()
  metaTitle?: string;

  @Prop()
  metaDescription?: string;

  @Prop()
  ogImageUrl?: string;

  @Prop()
  eventDate: Date;
}

export type EventDocument = HydratedDocument<Event>;
export const EventSchema = SchemaFactory.createForClass(Event);