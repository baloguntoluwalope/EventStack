import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity } from '../../../../common/base/base-entity.schema';

export enum SectionType {
  HERO = 'hero', ABOUT = 'about', COUNTDOWN = 'countdown', PROGRAMME = 'programme',
  SPEAKERS = 'speakers', COMMITTEE = 'committee', GALLERY = 'gallery', VENUE = 'venue',
  DONATION = 'donation', LIVESTREAM = 'livestream', CONTACT = 'contact',
  FAQ = 'faq', SPONSORS = 'sponsors', FOOTER = 'footer',
}

@Schema({ timestamps: true })
export class Section extends BaseEntity {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  eventId: Types.ObjectId;

  @Prop({ enum: SectionType, required: true })
  type: SectionType;

  @Prop({ default: 0 })
  order: number;

  @Prop({ type: Object, default: {} })
  content: Record<string, any>;

  @Prop({ default: true })
  visible: boolean;
}
export type SectionDocument = HydratedDocument<Section>;
export const SectionSchema = SchemaFactory.createForClass(Section);