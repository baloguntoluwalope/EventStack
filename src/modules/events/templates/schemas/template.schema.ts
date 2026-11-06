import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import {
  HydratedDocument,
  Schema as MongooseSchema,
} from 'mongoose';

import { BaseEntity } from '../../../../common/base/base-entity.schema';

// =========================================================
// DEFAULT SECTION
// =========================================================

@Schema({ _id: false })
export class DefaultSection {
  @Prop({
    required: true,
    set: (v: string) =>
      typeof v === 'string' ? v.trim() : v,
  })
  type: string;

  @Prop({
    required: true,
    default: 0,
  })
  order: number;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    default: {},
  })
  content?: Record<string, any>;

  /**
   * Stable identity of this section inside the template.
   *
   * Example:
   * hero-main
   * about-main
   * speakers-main
   */
  @Prop({
    type: String,
    default: null,
  })
  key?: string;
}

export const DefaultSectionSchema =
  SchemaFactory.createForClass(
    DefaultSection,
  );

// =========================================================
// DEFAULT PAGE
// =========================================================

@Schema({ _id: false })
export class DefaultPage {
  /**
   * Stable identity of the template page.
   *
   * This MUST NOT depend on array position.
   *
   * Example:
   * home
   * about
   * programme
   * gallery
   */
  @Prop({
    type: String,
    default: null,
  })
  key?: string;

  @Prop({
    required: true,
  })
  title: string;

  @Prop({
    default: '',
  })
  slug: string;

  /**
   * Explicit page ordering.
   */
  @Prop({
    default: 0,
  })
  order: number;

  @Prop({
    default: false,
  })
  isHome: boolean;

  @Prop({
    default: true,
  })
  showInNav: boolean;

  @Prop({
    type: [DefaultSectionSchema],
    default: [],
  })
  sections: DefaultSection[];
}

export const DefaultPageSchema =
  SchemaFactory.createForClass(
    DefaultPage,
  );

// =========================================================
// TEMPLATE
// =========================================================

@Schema({
  timestamps: true,
})
export class Template extends BaseEntity {
  @Prop({
    required: true,
  })
  name: string;

  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  slug: string;

  @Prop()
  category: string;

  @Prop()
  description: string;

  @Prop()
  previewImageUrl: string;

  /**
   * Legacy/single-page sections.
   *
   * These are treated as Home sections.
   */
  @Prop({
    type: [DefaultSectionSchema],
    default: [],
  })
  defaultSections: DefaultSection[];

  /**
   * Multi-page template definition.
   */
  @Prop({
    type: [DefaultPageSchema],
    default: [],
  })
  defaultPages: DefaultPage[];

  @Prop({
    default: false,
  })
  isPremium: boolean;

  @Prop({
    default: true,
    index: true,
  })
  active: boolean;

  /**
   * Incremented whenever the actual template
   * structure/content changes.
   */
  @Prop({
    default: 1,
  })
  declare version: number;
}

export type TemplateDocument =
  HydratedDocument<Template>;

export const TemplateSchema =
  SchemaFactory.createForClass(Template);

// =========================================================
// PRE SAVE NORMALIZATION
// =========================================================

TemplateSchema.pre(
  'save',
  function (next) {
    // -------------------------------------------------------
    // LEGACY SECTIONS
    // -------------------------------------------------------

    if (
      Array.isArray(this.defaultSections)
    ) {
      this.defaultSections.forEach(
        (section) => {
          if (
            typeof section.type ===
            'string'
          ) {
            section.type =
              section.type.trim();
          }

          if (
            typeof section.key ===
            'string'
          ) {
            section.key =
              section.key.trim();
          }

          if (
            !Number.isInteger(
              section.order,
            )
          ) {
            section.order = 0;
          }
        },
      );
    }

    // -------------------------------------------------------
    // TEMPLATE PAGES
    // -------------------------------------------------------

    if (
      Array.isArray(this.defaultPages)
    ) {
      this.defaultPages.forEach(
        (page, pageIndex) => {
          if (
            typeof page.title ===
            'string'
          ) {
            page.title =
              page.title.trim();
          }

          if (
            typeof page.slug ===
            'string'
          ) {
            page.slug =
              page.slug.trim();
          }

          if (
            typeof page.key ===
            'string'
          ) {
            page.key =
              page.key.trim();
          }

          if (
            !Number.isInteger(
              page.order,
            )
          ) {
            page.order = pageIndex;
          }

          if (
            !Array.isArray(
              page.sections,
            )
          ) {
            page.sections = [];
          }

          page.sections.forEach(
            (
              section,
              sectionIndex,
            ) => {
              if (
                typeof section.type ===
                'string'
              ) {
                section.type =
                  section.type.trim();
              }

              if (
                typeof section.key ===
                'string'
              ) {
                section.key =
                  section.key.trim();
              }

              if (
                !Number.isInteger(
                  section.order,
                )
              ) {
                section.order =
                  sectionIndex;
              }
            },
          );
        },
      );
    }

    next();
  },
);




// import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
// import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
// import { BaseEntity } from '../../../../common/base/base-entity.schema';

// @Schema({ _id: false })
// export class DefaultSection {
//   @Prop({
//     required: true,
//     set: (v: string) => (typeof v === 'string' ? v.trim() : v),
//   })
//   type: string;

//   @Prop({ required: true })
//   order: number;

//   @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
//   content?: Record<string, any>;

//   @Prop()
//   key?: string;
// }

// export const DefaultSectionSchema = SchemaFactory.createForClass(DefaultSection);

// @Schema({ _id: false })
// export class DefaultPage {
//   @Prop({ required: true })
//   title: string;

//   @Prop({ default: '' })
//   slug: string;

//   @Prop({ default: false })
//   isHome: boolean;

//   @Prop({ type: [DefaultSectionSchema], default: [] })
//   sections: DefaultSection[];
// }

// export const DefaultPageSchema = SchemaFactory.createForClass(DefaultPage);

// @Schema({ timestamps: true })
// export class Template extends BaseEntity {
//   @Prop({ required: true })
//   name: string;

//   @Prop({ required: true, unique: true, index: true })
//   slug: string;

//   @Prop()
//   category: string;

//   @Prop()
//   description: string;

//   @Prop()
//   previewImageUrl: string;

//   @Prop({ type: [DefaultSectionSchema], default: [] })
//   defaultSections: DefaultSection[];

//   @Prop({ type: [DefaultPageSchema], default: [] })
//   defaultPages: DefaultPage[];

//   @Prop({ default: false })
//   isPremium: boolean;

//   @Prop({ default: true, index: true })
//   active: boolean;

//   @Prop({ default: 1 })
//   declare version: number;
// }

// export type TemplateDocument = HydratedDocument<Template>;
// export const TemplateSchema = SchemaFactory.createForClass(Template);

// // Clean pre-save hook for document instantiation
// TemplateSchema.pre('save', function (next) {
//   if (Array.isArray(this.defaultSections)) {
//     this.defaultSections.forEach((s) => {
//       if (typeof s.type === 'string') s.type = s.type.trim();
//     });
//   }

//   if (Array.isArray(this.defaultPages)) {
//     this.defaultPages.forEach((p) => {
//       if (Array.isArray(p.sections)) {
//         p.sections.forEach((s) => {
//           if (typeof s.type === 'string') s.type = s.type.trim();
//         });
//       }
//     });
//   }

//   next();
// });