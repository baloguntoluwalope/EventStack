import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import {
  HydratedDocument,
} from 'mongoose';

import {
  BaseEntity,
} from '../../../../common/base/base-entity.schema';

@Schema({
  _id: false,
})
export class DefaultSection {
  @Prop({
    required: true,
  })
  type: string;

  @Prop({
    required: true,
  })
  order: number;

  @Prop({
    type: Object,
    default: {},
  })
  content?: Record<
    string,
    any
  >;
}

export const DefaultSectionSchema =
  SchemaFactory.createForClass(
    DefaultSection,
  );

@Schema({
  _id: false,
})
export class DefaultPage {
  @Prop({
    required: true,
  })
  title: string;

  @Prop({
    default: '',
  })
  slug: string;

  @Prop({
    default: false,
  })
  isHome: boolean;

  @Prop({
    type: [
      DefaultSectionSchema,
    ],
    default: [],
  })
  sections: DefaultSection[];
}

export const DefaultPageSchema =
  SchemaFactory.createForClass(
    DefaultPage,
  );

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

  /*
   * Legacy single-page template support.
   */
  @Prop({
    type: [
      DefaultSectionSchema,
    ],
    default: [],
  })
  defaultSections: DefaultSection[];

  /*
   * New multi-page template support.
   */
  @Prop({
    type: [
      DefaultPageSchema,
    ],
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
}

export type TemplateDocument =
  HydratedDocument<Template>;

export const TemplateSchema =
  SchemaFactory.createForClass(
    Template,
  );