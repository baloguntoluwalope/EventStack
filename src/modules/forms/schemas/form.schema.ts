import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity } from '../../../common/base/base-entity.schema';

export enum FormFieldType {
  TEXT = 'text', TEXTAREA = 'textarea', EMAIL = 'email', PHONE = 'phone',
  NUMBER = 'number', SELECT = 'select', MULTISELECT = 'multiselect',
  CHECKBOX = 'checkbox', DATE = 'date', FILE = 'file',
}

export enum FormStatus { DRAFT = 'draft', PUBLISHED = 'published', CLOSED = 'closed' }


export enum FormPurpose {
  REGISTRATION = 'registration',
  VOLUNTEER = 'volunteer',
  NOMINATION = 'nomination',
  MEMBERSHIP = 'membership',
  BOOKING = 'booking',
  GENERAL = 'general',
}


/**
 * 'Event' | 'Organization' | 'Tournament' — deliberately capitalized to
 * exactly match real Mongoose model names. This isn't just a label: it
 * powers Mongoose's built-in `refPath` feature (below), which lets ONE
 * field point at documents in DIFFERENT collections depending on what
 * this string says. Without refPath, we'd need a separate `eventId`,
 * `organizationId`, `tournamentId` field on every Form, and every future
 * owner type would mean another schema migration.
 */
export enum FormOwnerType { EVENT = 'Event', ORGANIZATION = 'Organization', TOURNAMENT = 'Tournament' }

@Schema({ _id: false })
export class FormField {
  /** Stable, unique-within-this-form key — this is what an answer in a
   * submission is keyed by. Never the field's label (which can change). */
  @Prop({ required: true }) key: string;
  @Prop({ required: true }) label: string;
  @Prop({ enum: FormFieldType, required: true }) type: FormFieldType;
  @Prop({ default: false }) required: boolean;
  @Prop({ type: [String], default: [] }) options: string[]; // for select/multiselect
  @Prop() placeholder: string;
}

@Schema({ _id: false })
class FormPrice {
  @Prop({ required: true }) amount: number; // stored in the smallest currency unit (kobo/cents) — same convention as IPaymentProvider.charge()
  @Prop({ default: 'NGN' }) currency: string;
}

@Schema({ _id: true })
export class FormShift {
  @Prop({ required: true }) label: string;
  @Prop({ required: true }) startsAt: Date;
  @Prop({ required: true }) endsAt: Date;
  @Prop({ type: Number, default: null }) capacity: number | null;
}

@Schema({ timestamps: true })
export class Form extends BaseEntity {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ enum: FormOwnerType, required: true })
  ownerType: FormOwnerType;

  @Prop({ type: Types.ObjectId, required: true, refPath: 'ownerType' })
  ownerId: Types.ObjectId;

  @Prop({ required: true }) title: string;
  @Prop() description: string;

  @Prop({ required: true }) slug: string;

  @Prop({ enum: FormStatus, default: FormStatus.DRAFT })
  status: FormStatus;

  @Prop({ type: [FormField], default: [] })
  fields: FormField[];

  @Prop({ enum: FormPurpose, default: FormPurpose.GENERAL, index: true })
  purpose: FormPurpose;

  @Prop({ default: false })
  requiresPayment: boolean;

  @Prop({ type: FormPrice, default: null })
  price: FormPrice | null;

  @Prop({ type: Number, default: null })
  maxSubmissions: number | null;

  @Prop({ type: [FormShift], default: [] })
  shifts: FormShift[];

  @Prop({ type: Date, default: null })
  closesAt: Date | null;
}

export type FormDocument = HydratedDocument<Form>;
export const FormSchema = SchemaFactory.createForClass(Form);

FormSchema.index({ organizationId: 1, slug: 1 }, { unique: true });