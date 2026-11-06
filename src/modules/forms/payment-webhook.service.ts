import { Inject, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  IPaymentProvider, PAYMENT_PROVIDER, InvalidWebhookError, NormalizedPaymentEvent,
} from '../../common/providers/payment-provider.interface';
import { PaymentEvent, PaymentEventDocument } from '../payments/schemas/payment-event.schema';
import { FormSubmissionsService } from './form-submissions.service';

@Injectable()
export class PaymentWebhookService {
  private readonly logger = new Logger(PaymentWebhookService.name);

  constructor(
    @Inject(PAYMENT_PROVIDER) private provider: IPaymentProvider,
    @InjectModel(PaymentEvent.name) private events: Model<PaymentEventDocument>,
    private submissions: FormSubmissionsService,
  ) {}

  async handle(providerName: string, rawBody: Buffer, headers: Record<string, string | string[] | undefined>) {
    // Only the configured provider may call us.
    if (providerName !== this.provider.name) throw new NotFoundException();

    let event: NormalizedPaymentEvent;
    try {
      event = this.provider.parseWebhook(rawBody, headers);
    } catch (err) {
      if (err instanceof InvalidWebhookError) {
        this.logger.warn(`Rejected ${providerName} webhook: ${err.message}`);
        throw new UnauthorizedException('Invalid webhook');
      }
      throw err;
    }

    // Claim the event id. The unique index lets exactly one insert win.
    try {
      await this.events.create({
        provider: providerName, eventId: event.eventId, type: event.type, reference: event.reference,
      });
    } catch (err: any) {
      if (err?.code !== 11000) throw err;
      const existing = await this.events.findOne({ provider: providerName, eventId: event.eventId }).lean();
      if (existing?.outcome) return { received: true, duplicate: true };
      // An earlier attempt crashed before finishing. Reprocessing is safe
      // because markPaid is atomic, so a ticket can't be issued twice.
    }

    const outcome = await this.submissions.applyPaymentEvent(event);
    await this.events.updateOne({ provider: providerName, eventId: event.eventId }, { outcome });
    return { received: true, outcome };
  }
}