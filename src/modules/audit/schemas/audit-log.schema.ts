import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ required: true })
  entity: string;

  @Prop({ required: true })
  action: string;

  // Add explicit `type: String` for nullable string unions
  @Prop({ type: String, default: null })
  userId: string | null;

  @Prop({ type: String, default: null, index: true })
  organizationId: string | null;

  @Prop({ type: String, default: null })
  entityId: string | null;

  // Mongoose handles dynamic key-value pairs via Schema.Types.Mixed
  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  oldValue: Record<string, any> | null;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  newValue: Record<string, any> | null;

  @Prop({ type: String })
  ipAddress: string;

  @Prop({ type: String })
  userAgent: string;
}

export type AuditLogDocument = HydratedDocument<AuditLog>;
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);