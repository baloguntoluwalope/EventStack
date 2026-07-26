import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseEntity } from '../../../../common/base/base-entity.schema';

@Schema({ _id: false })
class DesignTokens {
  @Prop({ required: true }) primaryColor: string;
  @Prop({ required: true }) secondaryColor: string;
  @Prop({ default: '#FFFFFF' }) backgroundColor?: string;
  @Prop({ required: true }) fontFamily: string;
  @Prop({ default: 1.0 }) fontScale?: number;
  @Prop({ default: '8px' }) radius?: string;
  @Prop({ default: '16px' }) spacing?: string;
  @Prop({ default: 'sm' }) shadow?: string;
}

@Schema({ timestamps: true })
export class Theme extends BaseEntity {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ type: DesignTokens, required: true })
  tokens: DesignTokens;

  @Prop({ default: false })
  isPremium: boolean;

  @Prop({ default: true })
  active: boolean;
}

export type ThemeDocument = HydratedDocument<Theme>;
export const ThemeSchema = SchemaFactory.createForClass(Theme);