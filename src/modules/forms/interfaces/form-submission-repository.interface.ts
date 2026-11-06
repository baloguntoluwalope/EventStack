import { FormSubmissionDocument } from '../schemas/form-submission.schema';

export interface IFormSubmissionRepository {
  create(data: Partial<FormSubmissionDocument>): Promise<FormSubmissionDocument>;
  findByIdForTenant(id: string, organizationId: string): Promise<FormSubmissionDocument | null>;
  updateById(id: string, data: Partial<FormSubmissionDocument>): Promise<FormSubmissionDocument | null>;
  findByFormForTenant(formId: string, organizationId: string): Promise<FormSubmissionDocument[]>;
  countActiveByForm(formId: string): Promise<number>;
  countActiveByFormAndShift(formId: string, shiftId: string): Promise<number>;
  findByPaymentReference(reference: string): Promise<FormSubmissionDocument | null>;
  findByProviderRef(providerRef: string): Promise<FormSubmissionDocument | null>;
  markPaid(reference: string, paidAmount: number, paidCurrency: string): Promise<FormSubmissionDocument | null>;
  markFailedIfPending(reference: string): Promise<FormSubmissionDocument | null>;
  findByTicketCodeForTenant(ticketCode: string, organizationId: string): Promise<FormSubmissionDocument | null>;
  findByTicketCodePublic(ticketCode: string): Promise<FormSubmissionDocument | null>;
    findByIdempotencyKey(formId: string, key: string): Promise<FormSubmissionDocument | null>;
}

export const FORM_SUBMISSION_REPOSITORY = 'FORM_SUBMISSION_REPOSITORY';