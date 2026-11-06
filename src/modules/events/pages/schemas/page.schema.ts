import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import {
  HydratedDocument,
  Types,
} from 'mongoose';

import {
  BaseEntity,
} from '../../../../common/base/base-entity.schema';

@Schema({
  timestamps: true,
})
export class Page extends BaseEntity {
  // =========================================================
  // TENANCY
  // =========================================================

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

  // =========================================================
  // PAGE CONTENT
  // =========================================================

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  title: string;

  /**
   * Public URL slug.
   *
   * Home:
   *   /e/:eventSlug
   *
   * Other pages:
   *   /e/:eventSlug/about
   */
  @Prop({
    type: String,
    default: '',
    trim: true,
  })
  slug: string;

  @Prop({
    type: Number,
    default: 0,
  })
  order: number;

  @Prop({
    type: Boolean,
    default: true,
  })
  showInNav: boolean;

  @Prop({
    type: Boolean,
    default: false,
  })
  isHome: boolean;

  // =========================================================
  // TEMPLATE SOURCE
  // =========================================================

  /**
   * Template this event page originated from.
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'Template',
    default: null,
    index: true,
  })
  sourceTemplateId: Types.ObjectId | null;

  /**
   * Stable template page identity.
   *
   * Example:
   *
   * home
   * schedule
   * speakers
   * contact
   *
   * IMPORTANT:
   *
   * This is used for synchronization.
   *
   * Do NOT use slug as the identity.
   */
  @Prop({
    type: String,
    default: null,
    index: true,
  })
  sourceTemplatePageKey:
    string | null;

  /**
   * Kept for backwards compatibility.
   *
   * Do not use this as the primary synchronization identity.
   */
  @Prop({
    type: String,
    default: null,
  })
  sourceTemplatePageSlug:
    string | null;

  /**
   * Template version from which this page
   * was last synchronized.
   */
  @Prop({
    type: Number,
    default: null,
  })
  sourceTemplateVersion:
    number | null;
}

// =========================================================
// DOCUMENT
// =========================================================

export type PageDocument =
  HydratedDocument<Page>;

// =========================================================
// SCHEMA
// =========================================================

export const PageSchema =
  SchemaFactory.createForClass(Page);

// =========================================================
// INDEXES
// =========================================================

/**
 * Slug only needs to be unique inside an event.
 */
PageSchema.index(
  {
    eventId: 1,
    slug: 1,
  },
  {
    unique: true,
  },
);

/**
 * Template page synchronization lookup.
 */
PageSchema.index({
  eventId: 1,
  sourceTemplateId: 1,
  sourceTemplatePageKey: 1,
});

/**
 * Event page ordering.
 */
PageSchema.index({
  organizationId: 1,
  eventId: 1,
  order: 1,
});