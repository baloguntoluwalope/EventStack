import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PaymentEventDocument = HydratedDocument<PaymentEvent>;

@Schema({ timestamps: true, collection: 'payment_events' })
export class PaymentEvent {
  @Prop({ required: true }) provider!: string;
  @Prop({ required: true }) eventId!: string;       // provider event ID
  @Prop({ required: true }) type!: string;          // normalized type
  @Prop({ type: String, default: null }) reference!: string | null;
  @Prop({ type: String, default: null }) outcome!: string | null; // e.g. paid, amount_mismatch, ignored
}
export const PaymentEventSchema = SchemaFactory.createForClass(PaymentEvent);
PaymentEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });