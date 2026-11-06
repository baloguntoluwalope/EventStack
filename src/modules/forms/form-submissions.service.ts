
import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
  NotFoundException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';

import {
  IFormSubmissionRepository,
  FORM_SUBMISSION_REPOSITORY,
} from './interfaces/form-submission-repository.interface';

import {
  IPaymentProvider,
  PAYMENT_PROVIDER,
  NormalizedPaymentEvent,
} from '../../common/providers/payment-provider.interface';

import {
  IEmailProvider,
  EMAIL_PROVIDER,
} from '../../common/providers/email-provider.interface';

import {
  IQrCodeService,
  QR_CODE_SERVICE,
} from '../qrcode/interfaces/qrcode-service.interface';

import { assertFound } from '../../common/utils/assert-found.util';
import { Role } from '../../common/constants/roles.constants';
import { MembersService } from '../tenancy/members/members.service';
import { FormsService } from './forms.service';
import { SubmitFormDto } from './dto/submit-form.dto';
import { FormStatus } from './schemas/form.schema';
import {
  PaymentStatus,
  ReviewStatus,
} from './schemas/form-submission.schema';

import { renderFormConfirmationEmail } from '../identity/email/templates/form-confirmation-email.template';

@Injectable()
export class FormSubmissionsService {
  private readonly logger = new Logger(FormSubmissionsService.name);

  constructor(
    @Inject(FORM_SUBMISSION_REPOSITORY)
    private readonly submissionRepo: IFormSubmissionRepository,

    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider: IPaymentProvider,

    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: IEmailProvider,

    @Inject(QR_CODE_SERVICE)
    private readonly qrCodeService: IQrCodeService,

    private readonly formsService: FormsService,
    private readonly membersService: MembersService,
    private readonly config: ConfigService,
  ) {}

  private get appUrl(): string {
    return this.config.get<string>('appUrl') ?? '';
  }

  // ---------------------------------------------------------------------
  // Idempotency replay
  // ---------------------------------------------------------------------

  /**
   * Returns the original response when a submission request
   * is repeated with the same idempotency key.
   */
  private replayResponse(s: any) {
    return {
      submission: s,

      payment: s.paymentReference
        ? {
            required: true,
            reference: s.paymentReference,
            authorizationUrl: s.paymentCheckoutUrl ?? null,
          }
        : {
            required: false,
          },

      replayed: true,
    };
  }

  // ---------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------

  async submit(
    organizationId: string,
    formId: string,
    dto: SubmitFormDto,
    idempotencyKey?: string,
  ) {
    // Validate idempotency key.
    if (
      idempotencyKey !== undefined &&
      (idempotencyKey.length < 8 || idempotencyKey.length > 128)
    ) {
      throw new BadRequestException(
        'Idempotency-Key must be 8 to 128 characters.',
      );
    }

    // Check for an existing submission before processing.
    if (idempotencyKey) {
      const existing =
        await this.submissionRepo.findByIdempotencyKey(
          formId,
          idempotencyKey,
        );

      if (existing) {
        return this.replayResponse(existing);
      }
    }

    // Retrieve the form.
    const form = await this.formsService.findByIdPublicOrThrow(formId);
    const submitterEmail = this.resolveEmail(form, dto);

    if (form.status !== FormStatus.PUBLISHED) {
      throw new BadRequestException(
        'This form is not accepting submissions.',
      );
    }

    if (form.closesAt && new Date() > form.closesAt) {
      throw new BadRequestException(
        'This form is no longer accepting submissions.',
      );
    }

    if (form.maxSubmissions !== null) {
      const taken =
        await this.submissionRepo.countActiveByForm(formId);

      if (taken >= form.maxSubmissions) {
        throw new BadRequestException(
          'This form has reached its submission limit.',
        );
      }
    }

    // Validate required fields on the backend.
    for (const field of form.fields) {
      const answer = dto.answers[field.key];

      if (
        field.required &&
        (answer === undefined || answer === null || answer === '')
      ) {
        throw new BadRequestException(
          `"${field.label}" is required.`,
        );
      }
    }

    // Validate shift.
    if (dto.shiftId) {
      const shift = (form.shifts as any[]).find(
        (s) => s._id.toString() === dto.shiftId,
      );

      if (!shift) {
        throw new BadRequestException(
          'That shift no longer exists on this form.',
        );
      }

      if (shift.capacity !== null) {
        const taken =
          await this.submissionRepo.countActiveByFormAndShift(
            formId,
            dto.shiftId,
          );

        if (taken >= shift.capacity) {
          throw new BadRequestException(
            `The "${shift.label}" shift is full.`,
          );
        }
      }
    }

    const needsPayment =
      form.requiresPayment &&
      !!form.price &&
      form.price.amount > 0;

    if (needsPayment && !submitterEmail) {
      throw new BadRequestException(
        'An email is required for paid submissions.',
      );
    }

    // Create submission.
    // The database unique index is the final protection against
    // simultaneous requests using the same idempotency key.

    let submission: any;

    try {
      submission = await this.submissionRepo.create({
        formId: formId as any,
        organizationId: organizationId as any,
        answers: dto.answers,
        submitterEmail: submitterEmail?.toLowerCase(),
        emailCopyRequested: !!dto.sendCopy,
        shiftId: (dto.shiftId as any) ?? null,

        paymentStatus: needsPayment
          ? PaymentStatus.PENDING
          : PaymentStatus.NOT_REQUIRED,

        reviewStatus: ReviewStatus.PENDING,

        idempotencyKey: idempotencyKey ?? null,
      });
    } catch (err: any) {
      // Another concurrent request may have created the submission first.
      if (err?.code === 11000 && idempotencyKey) {
        const winner =
          await this.submissionRepo.findByIdempotencyKey(
            formId,
            idempotencyKey,
          );

        if (winner) {
          return this.replayResponse(winner);
        }
      }

      throw err;
    }

    // -------------------------------------------------------------------
    // Free form
    // -------------------------------------------------------------------

    if (!needsPayment) {
      const finished = await this.finalize(submission, form);

      return {
        submission: finished,
        payment: {
          required: false,
        },
        replayed: false,
      };
    }

    // -------------------------------------------------------------------
    // Paid form
    // -------------------------------------------------------------------

    // Store internal payment reference and expected amount before
    // contacting the payment provider.
    const reference = `es_${submission.id}_${randomBytes(4).toString('hex')}`;

    await this.submissionRepo.updateById(submission.id, {
      paymentReference: reference,
      paymentProvider: this.paymentProvider.name,
      expectedAmount: form.price!.amount,
      expectedCurrency: form.price!.currency,
    });

    // Do not issue a ticket or send confirmation until a verified
    // payment webhook confirms successful payment.
    try {
      const charge = await this.paymentProvider.charge(
        form.price!.amount,
        form.price!.currency,
        submitterEmail!,
        {
          reference,
          successUrl: `${this.appUrl}/forms/payment-complete`,
          cancelUrl: `${this.appUrl}/forms/payment-cancelled`,
          metadata: {
            submissionId: submission.id,
            formId,
            organizationId,
          },
        },
      );

      // Persist both provider reference and checkout URL.
      const updated = await this.submissionRepo.updateById(
        submission.id,
        {
          paymentProviderRef: charge.providerRef,
          paymentCheckoutUrl: charge.authorizationUrl ?? null,
        },
      );

      return {
        submission: updated ?? submission,

        payment: {
          required: true,
          reference,
          authorizationUrl: charge.authorizationUrl ?? null,
        },

        replayed: false,
      };
    } catch (err: any) {
      this.logger.error(
        `Could not start payment for submission ${submission.id}: ${err.message}`,
      );

      await this.submissionRepo.updateById(submission.id, {
        paymentStatus: PaymentStatus.FAILED,
      });

      throw new ServiceUnavailableException(
        'Payment is temporarily unavailable. Please try again shortly.',
      );
    }
  }

  // ---------------------------------------------------------------------
  // Payment confirmation
  // ---------------------------------------------------------------------

  /**
   * The only method that decides whether a submission is paid.
   *
   * The incoming event must already have been verified by the
   * payment provider's webhook signature verification.
   *
   * A redirect URL cannot confirm payment.
   */
  async applyPaymentEvent(
    event: NormalizedPaymentEvent,
  ): Promise<string> {
    if (event.type === 'ignored') {
      return 'ignored';
    }

    const submission =
      (event.reference
        ? await this.submissionRepo.findByPaymentReference(
            event.reference,
          )
        : null) ??
      (event.providerRef
        ? await this.submissionRepo.findByProviderRef(
            event.providerRef,
          )
        : null);

    if (!submission) {
      this.logger.warn(
        `Payment event ${event.eventId} matches no submission`,
      );

      return 'unknown_reference';
    }

    // Verify that internal and provider references agree.
    if (
      event.providerRef &&
      submission.paymentProviderRef &&
      event.providerRef !== submission.paymentProviderRef
    ) {
      this.logger.error(
        `Provider ref mismatch on ${submission.paymentReference}`,
      );

      return 'reference_mismatch';
    }

    // A failed attempt does not necessarily mean the payment
    // process is permanently failed.
    if (event.type === 'payment.attempt_failed') {
      return 'attempt_failed_recorded';
    }

    if (event.type === 'payment.needs_review') {
      this.logger.error(
        `Payment on ${submission.paymentReference} needs manual review`,
      );

      return 'needs_review';
    }

    // Payment succeeded.
    if (submission.paymentStatus === PaymentStatus.PAID) {
      return 'already_paid';
    }

    if (!submission.paymentReference) {
      this.logger.error(
        `Cannot apply payment event ${event.eventId}: submission has no internal payment reference`,
      );

      return 'missing_reference';
    }

    // Verify expected amount and currency.
    const amountOk =
      event.amountMinor === submission.expectedAmount &&
      event.currency?.toUpperCase() ===
        submission.expectedCurrency?.toUpperCase();

    if (!amountOk) {
      this.logger.error(
        `Amount mismatch on ${submission.paymentReference}: got ${event.amountMinor} ${event.currency}, expected ${submission.expectedAmount} ${submission.expectedCurrency}`,
      );

      return 'amount_mismatch';
    }

    // Atomic repository operation prevents duplicate webhook
    // deliveries from issuing multiple tickets.
    const paid = await this.submissionRepo.markPaid(
      submission.paymentReference,
      event.amountMinor!,
      event.currency!.toUpperCase(),
    );

    if (!paid) {
      return 'already_paid';
    }

    const form = await this.formsService.findByIdPublicOrThrow(
      paid.formId.toString(),
    );

    await this.finalize(paid, form);

    return 'paid';
  }

  // ---------------------------------------------------------------------
  // Payment status
  // ---------------------------------------------------------------------

  /**
   * Read-only endpoint.
   * The frontend polls this until the verified webhook arrives.
   */
  async getPaymentStatus(q: {
    reference?: string;
    checkoutId?: string;
  }) {
    const s = q.reference
      ? await this.submissionRepo.findByPaymentReference(
          q.reference,
        )
      : q.checkoutId
        ? await this.submissionRepo.findByProviderRef(
            q.checkoutId,
          )
        : null;

    if (!s) {
      throw new NotFoundException('Payment not found');
    }

    // This endpoint is public, so never expose answers or emails.
    return {
      paymentStatus: s.paymentStatus,

      ticketCode:
        s.paymentStatus === PaymentStatus.PAID
          ? s.ticketCode ?? null
          : null,
    };
  }

  // ---------------------------------------------------------------------
  // Ticket + confirmation email
  // ---------------------------------------------------------------------

  /**
   * Generates the ticket and sends confirmation once per submission.
   */
  private async finalize(submission: any, form: any) {
    if (submission.ticketCode) {
      return submission;
    }

    const ticketCode = randomBytes(8).toString('hex');

    const qrCodeUrl = await this.qrCodeService.generate(
      `${this.appUrl}/check-in/${ticketCode}`,
    );

    const updated =
      (await this.submissionRepo.updateById(
        submission.id,
        {
          ticketCode,
          qrCodeUrl,
        },
      )) ?? submission;

    if (submission.submitterEmail) {
      try {
        const paid =
          submission.paymentStatus === PaymentStatus.PAID;

        await this.emailProvider.send(
          submission.submitterEmail,

          paid
            ? `Payment received: you're registered for ${form.title}`
            : `You're registered for ${form.title}`,

          renderFormConfirmationEmail({
            formTitle: form.title,
            ticketUrl: `${this.appUrl}/tickets/${ticketCode}`,
            appUrl: this.appUrl,
            paid,

            answers: submission.emailCopyRequested
              ? this.answerRows(form, submission.answers)
              : undefined,
          }),
        );

        await this.submissionRepo.updateById(
          submission.id,
          {
            confirmationEmailSentAt: new Date(),
          },
        );
      } catch (err: any) {
        // Never undo a valid submission because of email failure.
        // A null confirmationEmailSentAt makes the failure visible.
        this.logger.error(
          `Confirmation email failed for submission ${submission.id}: ${err.message}`,
        );
      }
    } else {
      this.logger.warn(
        `Submission ${submission.id} has no email, so no confirmation was sent`,
      );
    }

    return updated;
  }

  // ---------------------------------------------------------------------
  // Email answer formatting
  // ---------------------------------------------------------------------

  private answerRows(
    form: any,
    answers: Record<string, any> = {},
  ) {
    return (form.fields as any[]).map((f) => {
      const v = answers[f.key];

      return {
        label: f.label,
        value: Array.isArray(v)
          ? v.join(', ')
          : v == null
            ? ''
            : String(v),
      };
    });
  }

  /**
   * Resolves an email from the explicit submitter email
   * or the form's first email-type field.
   */
  private resolveEmail(
    form: any,
    dto: SubmitFormDto,
  ): string | undefined {
    if (dto.submitterEmail) {
      return dto.submitterEmail.toLowerCase();
    }

    const emailField = (form.fields as any[]).find(
      (f) => f.type === 'email',
    );

    const v = emailField
      ? dto.answers[emailField.key]
      : undefined;

    return typeof v === 'string' && v.includes('@')
      ? v.toLowerCase()
      : undefined;
  }

  // ---------------------------------------------------------------------
  // Public ticket
  // ---------------------------------------------------------------------

  async getTicketPublic(ticketCode: string) {
    const submission = await assertFound(
      await this.submissionRepo.findByTicketCodePublic(ticketCode),
      'Ticket not found',
    );

    const form = await this.formsService.findByIdPublicOrThrow(
      submission.formId.toString(),
    );

    return {
      formTitle: form.title,
      ticketCode: submission.ticketCode,
      qrCodeUrl: submission.qrCodeUrl,
      checkedIn: !!submission.checkedInAt,
      paymentStatus: submission.paymentStatus,
    };
  }

  // ---------------------------------------------------------------------
  // Organizer actions
  // ---------------------------------------------------------------------

  async listForForm(
    formId: string,
    organizationId: string,
  ) {
    await this.formsService.findByIdOrThrow(
      formId,
      organizationId,
    );

    return this.submissionRepo.findByFormForTenant(
      formId,
      organizationId,
    );
  }

  async updateReviewStatus(
    submissionId: string,
    organizationId: string,
    reviewStatus: ReviewStatus,
  ) {
    await assertFound(
      await this.submissionRepo.findByIdForTenant(
        submissionId,
        organizationId,
      ),
      'Submission not found',
    );

    return assertFound(
      await this.submissionRepo.updateById(
        submissionId,
        { reviewStatus },
      ),
      'Submission not found',
    );
  }

  // ---------------------------------------------------------------------
  // Check-in
  // ---------------------------------------------------------------------

  async checkIn(
    organizationId: string,
    ticketCode: string,
  ) {
    const submission = await assertFound(
      await this.submissionRepo.findByTicketCodeForTenant(
        ticketCode,
        organizationId,
      ),
      'Ticket not found',
    );

    if (
      submission.paymentStatus === PaymentStatus.PENDING ||
      submission.paymentStatus === PaymentStatus.FAILED
    ) {
      throw new BadRequestException(
        'This ticket has not been paid for.',
      );
    }

    if (submission.checkedInAt) {
      throw new BadRequestException(
        `Already checked in at ${submission.checkedInAt.toISOString()}`,
      );
    }

    return assertFound(
      await this.submissionRepo.updateById(
        submission.id,
        { checkedInAt: new Date() },
      ),
      'Submission not found',
    );
  }

  // ---------------------------------------------------------------------
  // Convert approved submission to member
  // ---------------------------------------------------------------------

  async convertToMember(
    submissionId: string,
    organizationId: string,
    invitedByUserId: string,
  ) {
    const submission = await assertFound(
      await this.submissionRepo.findByIdForTenant(
        submissionId,
        organizationId,
      ),
      'Submission not found',
    );

    if (submission.reviewStatus !== ReviewStatus.APPROVED) {
      throw new BadRequestException(
        'Only approved submissions can be converted to a member.',
      );
    }

    if (!submission.submitterEmail) {
      throw new BadRequestException(
        'This submission has no email address to invite.',
      );
    }

    return this.membersService.invite(
      organizationId,
      invitedByUserId,
      {
        email: submission.submitterEmail,
        role: Role.VOLUNTEER,
      },
    );
  }
}
