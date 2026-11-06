import { Injectable, Logger } from '@nestjs/common';
import {
  IPaymentProvider, PaymentChargeResult, ChargeOptions, InvalidWebhookError,
} from '../../../common/providers/payment-provider.interface';

/** Dev fallback: moves no money and never confirms a payment. */
@Injectable()
export class StubPaymentProvider implements IPaymentProvider {
  readonly name = 'stub';
  private readonly logger = new Logger(StubPaymentProvider.name);

  async charge(amountMinor: number, currency: string, customerEmail: string, options: ChargeOptions): Promise<PaymentChargeResult> {
    this.logger.warn(`[STUB] ${amountMinor} ${currency} for ${customerEmail} recorded as pending. No money moved.`);
    return { reference: options.reference, status: 'pending' };
  }

  parseWebhook(): never {
    throw new InvalidWebhookError('Stub provider has no webhooks');
  }
}