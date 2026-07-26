import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity } from '../../../common/base/base-entity.schema';

export enum AnalyticsEventType {
  PAGE_VIEW = 'page_view',
  QR_SCAN = 'qr_scan',
  GALLERY_VIEW = 'gallery_view',
  LIVESTREAM_CLICK = 'livestream_click',
  EVENT_PUBLISHED = 'event_published',
}

@Schema({ timestamps: true })
export class AnalyticsEvent extends BaseEntity {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  eventId: Types.ObjectId;

  @Prop({ enum: AnalyticsEventType, required: true })
  type: AnalyticsEventType;

  @Prop({ type: Object, default: {} })
  meta: Record<string, any>;
}
export type AnalyticsEventDocument = HydratedDocument<AnalyticsEvent>;
export const AnalyticsEventSchema = SchemaFactory.createForClass(AnalyticsEvent);