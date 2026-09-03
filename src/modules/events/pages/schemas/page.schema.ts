import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity } from '../../../../common/base/base-entity.schema';

@Schema({ timestamps: true })
export class Page extends BaseEntity {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  eventId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  /** '' reserved exclusively for the home page — /e/:eventSlug with no
   * suffix. Every other page gets a real, non-empty, event-unique slug. */
  @Prop({ default: '' })
  slug: string;

  @Prop({ default: 0 })
  order: number;

  @Prop({ default: true })
  showInNav: boolean;

  @Prop({ default: false })
  isHome: boolean;
}
export type PageDocument = HydratedDocument<Page>;
export const PageSchema = SchemaFactory.createForClass(Page);

// A slug must be unique within one event, not globally — two different
// events can both have a page called "about".
PageSchema.index(
  {
    eventId: 1,
    slug: 1,
  },
  {
    unique: true,
  },
);