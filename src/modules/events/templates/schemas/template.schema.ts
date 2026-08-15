import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseEntity } from '../../../../common/base/base-entity.schema';

@Schema({ _id: false })
export class DefaultSection {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  order: number;

  @Prop({ type: Object, required: false, default: {} })
  content?: Record<string, any>;
}

export const DefaultSectionSchema = SchemaFactory.createForClass(DefaultSection);

@Schema({ timestamps: true })
export class Template extends BaseEntity {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop()
  category: string; // e.g. 'church', 'conference', 'wedding'

  @Prop()
  description: string;

  @Prop()
  previewImageUrl: string;

  @Prop({ type: [DefaultSectionSchema], default: [] })
  defaultSections: DefaultSection[];

  @Prop({ default: false })
  isPremium: boolean;

  @Prop({ default: true })
  active: boolean;
}

export type TemplateDocument = HydratedDocument<Template>;
export const TemplateSchema = SchemaFactory.createForClass(Template);