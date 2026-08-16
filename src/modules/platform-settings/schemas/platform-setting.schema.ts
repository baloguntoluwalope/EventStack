import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class PlatformSetting {
  @Prop({ required: true, unique: true }) key: string;
  @Prop({ type: Object }) value: Record<string, any>;
}
export type PlatformSettingDocument = HydratedDocument<PlatformSetting>;
export const PlatformSettingSchema = SchemaFactory.createForClass(PlatformSetting);