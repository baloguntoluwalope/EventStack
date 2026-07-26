import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity } from '../../../common/base/base-entity.schema';

export enum MediaType { IMAGE = 'image', VIDEO = 'video' }

@Schema({ timestamps: true })
export class Media extends BaseEntity {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  eventId: Types.ObjectId;

  @Prop({ required: true })
  url: string;

  @Prop({ enum: MediaType, default: MediaType.IMAGE })
  type: MediaType;

  @Prop()
  storagePublicId: string;
}
export type MediaDocument = HydratedDocument<Media>;
export const MediaSchema = SchemaFactory.createForClass(Media);