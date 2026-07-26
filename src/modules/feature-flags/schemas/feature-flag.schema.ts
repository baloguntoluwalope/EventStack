import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// Create a compound index so keys are unique per organization (or global if organizationId is null)
@Schema({ timestamps: true })
export class FeatureFlag {
  @Prop({ required: true })
  key: string;

  @Prop({ default: false })
  enabled: boolean;

  // Added explicit `type: String` to avoid CannotDetermineTypeError
  @Prop({ type: String, default: null, index: true })
  organizationId: string | null;

  @Prop({ type: String })
  description?: string;
}

export type FeatureFlagDocument = HydratedDocument<FeatureFlag>;
export const FeatureFlagSchema = SchemaFactory.createForClass(FeatureFlag);

// Compound unique index ensuring key is unique within a tenant
FeatureFlagSchema.index({ organizationId: 1, key: 1 }, { unique: true });