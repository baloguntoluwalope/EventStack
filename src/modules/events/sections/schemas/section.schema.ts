import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';
import { BaseEntity } from '../../../../common/base/base-entity.schema';

export enum SectionType {
  HERO = 'hero',
  ABOUT = 'about',
  COUNTDOWN = 'countdown',
  PROGRAMME = 'programme',
  SPEAKERS = 'speakers',
  COMMITTEE = 'committee',
  GALLERY = 'gallery',
  VENUE = 'venue',
  DONATION = 'donation',
  LIVESTREAM = 'livestream',
  CONTACT = 'contact',
  FAQ = 'faq',
  SPONSORS = 'sponsors',
  FOOTER = 'footer',
  TESTIMONIALS = 'testimonials',
}

@Schema({ timestamps: true, minimize: false })
export class Section extends BaseEntity {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  eventId: Types.ObjectId;

  @Prop({ enum: SectionType, required: true })
  type: SectionType;

  @Prop({ default: 0 })
  order: number;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  content: Record<string, any>;

  @Prop({ default: true })
  visible: boolean;
}

export type SectionDocument = HydratedDocument<Section>;
export const SectionSchema = SchemaFactory.createForClass(Section);

// Ensure virtuals (like `id`) and full objects are serialized in JSON responses
SectionSchema.set('toJSON', {
  virtuals: true,
  transform: (_, ret: Record<string, any>) => {
    ret.id = ret._id?.toString();
    return ret;
  },
});

// Compound index for tenant-scoped event section queries
SectionSchema.index({ organizationId: 1, eventId: 1, _id: 1 });
SectionSchema.index({ eventId: 1, order: 1 });