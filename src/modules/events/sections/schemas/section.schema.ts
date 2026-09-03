import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import {
  HydratedDocument,
  Types,
  Schema as MongooseSchema,
} from 'mongoose';

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

  // Sports
  LIVE_MATCH = 'live_match',
  FIXTURES = 'fixtures',
  STANDINGS = 'standings',
  TEAMS = 'teams',
  PLAYERS = 'players',
  KNOCKOUT_BRACKET = 'knockout_bracket',
}

@Schema({
  timestamps: true,
  minimize: false,
})
export class Section extends BaseEntity {
  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  })
  organizationId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true,
  })
  eventId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Page',
    default: null,
    index: true,
  })
  pageId: Types.ObjectId | null;

  @Prop({
    enum: SectionType,
    required: true,
  })
  type: SectionType;

  @Prop({
    default: 0,
  })
  order: number;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    default: {},
  })
  content: Record<string, any>;

  @Prop({
    default: true,
  })
  visible: boolean;
}

export type SectionDocument =
  HydratedDocument<Section>;

export const SectionSchema =
  SchemaFactory.createForClass(Section);

SectionSchema.set('toJSON', {
  virtuals: true,

  transform: (
    _doc,
    ret: Record<string, any>,
  ) => {
    ret.id =
      ret._id?.toString();

    return ret;
  },
});

SectionSchema.index({
  organizationId: 1,
  eventId: 1,
  _id: 1,
});

SectionSchema.index({
  eventId: 1,
  order: 1,
});

SectionSchema.index({
  organizationId: 1,
  eventId: 1,
  pageId: 1,
  order: 1,
});