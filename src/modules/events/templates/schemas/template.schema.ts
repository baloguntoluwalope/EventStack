import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseEntity } from '../../../../common/base/base-entity.schema';

@Schema({ _id: false })
class DefaultSection {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  order: number;
}

@Schema({ timestamps: true })
export class Template extends BaseEntity {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop()
  category: string; // e.g. 'church', 'conference', 'wedding' — matches OrgType loosely, not enforced

  @Prop()
  description: string;

  @Prop()
  previewImageUrl: string;

  @Prop({ type: [DefaultSection], default: [] })
  defaultSections: DefaultSection[];

  @Prop({ default: false })
  isPremium: boolean;

  @Prop({ default: true })
  active: boolean;
}
export type TemplateDocument = HydratedDocument<Template>;
export const TemplateSchema = SchemaFactory.createForClass(Template);