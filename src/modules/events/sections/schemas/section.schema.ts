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

import {
  BaseEntity,
} from '../../../../common/base/base-entity.schema';

// =========================================================
// SECTION TYPES
// =========================================================

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
  PRICING = 'pricing',
  FOOTER = 'footer',
  TESTIMONIALS = 'testimonials',

  // SPORTS
  LIVE_MATCH = 'live_match',
  FIXTURES = 'fixtures',
  STANDINGS = 'standings',
  TEAMS = 'teams',
  PLAYERS = 'players',
  KNOCKOUT_BRACKET = 'knockout_bracket',
}

// =========================================================
// SECTION
// =========================================================

@Schema({
  timestamps: true,
  minimize: false,
})
export class Section extends BaseEntity {
  // =======================================================
  // TENANCY
  // =======================================================

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

  // =======================================================
  // PAGE
  // =======================================================

  @Prop({
    type: Types.ObjectId,
    ref: 'Page',
    default: null,
    index: true,
  })
  pageId: Types.ObjectId | null;

  // =======================================================
  // SECTION
  // =======================================================

  @Prop({
    enum: SectionType,
    required: true,
  })
  type: SectionType;

  /**
   * Position inside the page.
   */
  @Prop({
    default: 0,
  })
  order: number;

  /**
   * Section content.
   */
  @Prop({
    type: MongooseSchema.Types.Mixed,
    default: {},
  })
  content: Record<string, any>;

  /**
   * Whether the section is visible.
   */
  @Prop({
    default: true,
  })
  visible: boolean;

  // =======================================================
  // TEMPLATE SOURCE
  // =======================================================

  /**
   * Template this section originated from.
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'Template',
    default: null,
    index: true,
  })
  sourceTemplateId:
    Types.ObjectId | null;

  /**
   * Stable identity of the template section.
   *
   * Examples:
   *
   * home.hero
   * home.about
   * home.livestream
   * schedule.programme
   */
  @Prop({
    type: String,
    default: null,
    index: true,
  })
  sourceTemplateSectionKey:
    string | null;

  /**
   * Template version from which this section
   * was last synchronized.
   */
  @Prop({
    type: Number,
    default: null,
  })
  sourceTemplateVersion:
    number | null;

  /**
   * Hash of the template content that was last
   * synchronized into this event section.
   */
  @Prop({
    type: String,
    default: null,
  })
  sourceTemplateContentHash:
    string | null;

  /**
   * True when organizer has manually changed
   * this event section.
   *
   * Template synchronization must not blindly
   * overwrite customized content.
   */
  @Prop({
    type: Boolean,
    default: false,
  })
  customizedByOrganizer: boolean;
}

// =========================================================
// DOCUMENT
// =========================================================

export type SectionDocument =
  HydratedDocument<Section>;

// =========================================================
// SCHEMA
// =========================================================

export const SectionSchema =
  SchemaFactory.createForClass(
    Section,
  );

// =========================================================
// JSON
// =========================================================

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

// =========================================================
// INDEXES
// =========================================================

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

SectionSchema.index({
  organizationId: 1,
  eventId: 1,
  visible: 1,
  order: 1,
});

/**
 * Template synchronization lookup.
 */
SectionSchema.index({
  eventId: 1,
  sourceTemplateId: 1,
  sourceTemplateSectionKey: 1,
});

/**
 * Page + template section lookup.
 */
SectionSchema.index({
  eventId: 1,
  pageId: 1,
  sourceTemplateSectionKey: 1,
});