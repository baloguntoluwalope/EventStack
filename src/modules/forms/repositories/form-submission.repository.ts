import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseTenantRepository } from '../../../common/base/base-tenant.repository';
import { FormSubmission, FormSubmissionDocument, PaymentStatus } from '../schemas/form-submission.schema';
import { IFormSubmissionRepository } from '../interfaces/form-submission-repository.interface';

const PENDING_HOLD_MS = 30 * 60 * 1000;

@Injectable()
export class MongooseFormSubmissionRepository
    extends BaseTenantRepository<FormSubmissionDocument>
    implements IFormSubmissionRepository
{
    constructor(@InjectModel(FormSubmission.name) model: Model<FormSubmissionDocument>) {
        super(model);
    }

    private activeFilter(base: Record<string, unknown>) {
        return {
            ...base,
            deletedAt: null,
            $or: [
                { paymentStatus: { $in: [PaymentStatus.PAID, PaymentStatus.NOT_REQUIRED] } },
                { paymentStatus: PaymentStatus.PENDING, createdAt: { $gte: new Date(Date.now() - PENDING_HOLD_MS) } },
            ],
        };
    }

    findByFormForTenant(formId: string, organizationId: string): Promise<FormSubmissionDocument[]> {
        return this.model.find({
            formId: this.toObjectId(formId),
            organizationId: this.toObjectId(organizationId),
            deletedAt: null,
        }).sort({ createdAt: -1 }).exec();
    }

    countActiveByForm(formId: string): Promise<number> {
        return this.model.countDocuments(this.activeFilter({ formId: this.toObjectId(formId) })).exec();
    }

    countActiveByFormAndShift(formId: string, shiftId: string): Promise<number> {
        return this.model.countDocuments(this.activeFilter({
            formId: this.toObjectId(formId),
            shiftId: this.toObjectId(shiftId),
        })).exec();
    }

    findByPaymentReference(reference: string): Promise<FormSubmissionDocument | null> {
        return this.model.findOne({ paymentReference: reference, deletedAt: null }).exec();
    }

    markFailedIfPending(reference: string): Promise<FormSubmissionDocument | null> {
        return this.model.findOneAndUpdate(
            { paymentReference: reference, paymentStatus: PaymentStatus.PENDING, deletedAt: null },
            { paymentStatus: PaymentStatus.FAILED },
            { new: true },
        ).exec();
    }

    findByTicketCodeForTenant(ticketCode: string, organizationId: string): Promise<FormSubmissionDocument | null> {
        return this.model.findOne({
            ticketCode,
            organizationId: this.toObjectId(organizationId),
            deletedAt: null,
        }).exec();
    }

    findByTicketCodePublic(ticketCode: string): Promise<FormSubmissionDocument | null> {
        return this.model.findOne({ ticketCode, deletedAt: null }).exec();
    }

        findByProviderRef(providerRef: string): Promise<FormSubmissionDocument | null> {
                return this.model.findOne({ paymentProviderRef: providerRef, deletedAt: null }).exec();
  }

  /** Atomic pending -> paid. Only the first caller gets a document back. */
    markPaid(reference: string, paidAmount: number, paidCurrency: string): Promise<FormSubmissionDocument | null> {
    return this.model.findOneAndUpdate(
            { paymentReference: reference, paymentStatus: PaymentStatus.PENDING, deletedAt: null },
      { paymentStatus: PaymentStatus.PAID, paidAt: new Date(), paidAmount, paidCurrency },
      { new: true },
    ).exec();
  }

    findByIdempotencyKey(formId: string, key: string) {
    return this.model.findOne({ formId, idempotencyKey: key, deletedAt: null }).exec();
  }
}
