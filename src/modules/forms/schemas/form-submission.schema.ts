import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity } from '../../../common/base/base-entity.schema';

export enum PaymentStatus {
  NOT_REQUIRED = 'not_required',
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
}

export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Schema({ timestamps: true })
export class FormSubmission extends BaseEntity {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId!: Types.ObjectId;

 
@Prop({ type: Types.ObjectId, ref: 'Form', required: true })
formId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null })
  shiftId?: Types.ObjectId | null;

  @Prop({ type: Object, required: true })
  answers!: Record<string, any>;

  @Prop()
  submitterEmail?: string;

  @Prop({ enum: PaymentStatus, default: PaymentStatus.NOT_REQUIRED })
  paymentStatus!: PaymentStatus;

  @Prop({ unique: true, sparse: true })
  paymentReference?: string;

  @Prop({ enum: ReviewStatus, default: ReviewStatus.PENDING })
  reviewStatus!: ReviewStatus;

  @Prop({ type: Date, default: null })
  paidAt!: Date | null;


  @Prop() paymentProvider?: string;

  /** The provider's own id (Bachs: chk_…). The return URL only carries this. */
  @Prop({ index: true, sparse: true }) paymentProviderRef?: string;

  /** What was actually paid, recorded from the verified webhook. */
  @Prop() paidAmount?: number;
  @Prop() paidCurrency?: string;

    @Prop({ default: false }) emailCopyRequested: boolean;
  @Prop({ type: Date, default: null })
  confirmationEmailSentAt!: Date | null;
  @Prop({ type: String, default: null })
  idempotencyKey: string | null;

  @Prop({ type: String, default: null })
  paymentCheckoutUrl: string | null;

  @Prop() expectedAmount?: number;
  @Prop() expectedCurrency?: string;
  @Prop({ unique: true, sparse: true })
  ticketCode?: string;

  @Prop()
  qrCodeUrl?: string;

  @Prop({ type: Date, default: null })
  checkedInAt!: Date | null;
}

export type FormSubmissionDocument = HydratedDocument<FormSubmission>;
export const FormSubmissionSchema = SchemaFactory.createForClass(FormSubmission);

FormSubmissionSchema.index(
  { formId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);