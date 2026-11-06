import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  IPaymentProvider, PaymentChargeResult, ChargeOptions,
  NormalizedPaymentEvent, InvalidWebhookError,
} from '../../../common/providers/payment-provider.interface';
import { minorToDecimalString, decimalStringToMinor } from '../../../common/utils/money.util';

const SIGNATURE_TOLERANCE_SECONDS = 300; // documented tolerance

@Injectable()
export class BachsPaymentProvider implements IPaymentProvider {
  readonly name = 'bachs';
  private readonly logger = new Logger(BachsPaymentProvider.name);
  private readonly apiKey: string;
  private readonly webhookSecret: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('payment.bachs.apiKey') ?? '';
    this.webhookSecret = config.get<string>('payment.bachs.webhookSecret') ?? '';
    const environment = config.get<string>('payment.bachs.environment') ?? 'sandbox';
    const allowLive = config.get<boolean>('payment.bachs.allowLive') === true;

    if (!this.apiKey || !this.webhookSecret) {
      throw new Error('PAYMENT_PROVIDER=bachs requires BACHS_API_KEY and BACHS_WEBHOOK_SECRET');
    }
    // A key only works in its own environment, so a mismatch is a config bug.
    const keyIsSandbox = this.apiKey.startsWith('sk_sandbox_');
    const keyIsLive = this.apiKey.startsWith('sk_live_');
    if (environment === 'sandbox' && !keyIsSandbox) throw new Error('BACHS_ENVIRONMENT=sandbox needs a key starting sk_sandbox_');
    if (environment === 'production') {
      if (!keyIsLive) throw new Error('BACHS_ENVIRONMENT=production needs a key starting sk_live_');
      // Live money needs a second, deliberate switch.
      if (!allowLive) throw new Error('Refusing live payments: set BACHS_ALLOW_LIVE=true to enable production.');
    }
    this.baseUrl = environment === 'production' ? 'https://api.bachs.io' : 'https://sandbox-api.bachs.io';
  }

  async charge(amountMinor: number, currency: string, customerEmail: string, options: ChargeOptions): Promise<PaymentChargeResult> {
    const response = await fetch(`${this.baseUrl}/v1/checkout-sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        // Documented: retries of the same operation don't create a second checkout.
        'Idempotency-Key': `checkout-${options.reference}`,
      },
      body: JSON.stringify({
        pricing: { currency, amount: minorToDecimalString(amountMinor) },
        customer: { email: customerEmail },
        reference: options.reference,
        success_url: options.successUrl,
        cancel_url: options.cancelUrl,
        metadata: options.metadata,
        expires_in_minutes: 60,
      }),
    });

    const json: any = await response.json().catch(() => null);
    if (!response.ok || !json?.checkout_url || !json?.checkout_id) {
      this.logger.error(`Bachs checkout creation failed (${response.status}): ${JSON.stringify(json)}`);
      throw new Error(`Bachs checkout creation failed (${response.status})`);
    }
    return {
      reference: options.reference,
      providerRef: json.checkout_id,
      status: 'pending', // the money moves later; only the webhook confirms it
      authorizationUrl: json.checkout_url,
    };
  }

  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): NormalizedPaymentEvent {
    const header = headers['x-bachs-signature-v2'];
    const value = Array.isArray(header) ? header[0] : header;
    if (!value) throw new InvalidWebhookError('Missing signature header');

    // Format: t={unix seconds},v1={hex}
    const parts = Object.fromEntries(value.split(',').map((p) => p.split('=') as [string, string]));
    const timestamp = Number(parts.t);
    if (!Number.isFinite(timestamp) || !parts.v1) throw new InvalidWebhookError('Malformed signature header');

    if (Math.abs(Date.now() / 1000 - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
      throw new InvalidWebhookError('Signature timestamp outside tolerance');
    }

    // Signed message: "{timestamp}.{raw body}", HMAC-SHA256, hex.
    const expected = createHmac('sha256', this.webhookSecret).update(`${parts.t}.`).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(parts.v1);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new InvalidWebhookError('Signature mismatch');

    let event: any;
    try { event = JSON.parse(rawBody.toString('utf8')); } catch { throw new InvalidWebhookError('Body is not JSON'); }
    if (!event?.id || !event?.type) throw new InvalidWebhookError('Unexpected event shape');

    return this.normalize(event);
  }

  private normalize(event: any): NormalizedPaymentEvent {
    const d = event.data ?? {};
    const base = {
      eventId: String(event.id),
      reference: d.reference ?? null,
      providerRef: d.checkout_id ?? null,
    };

    if (event.type === 'collection.succeeded') {
      const status = String(d.status ?? '').toUpperCase(); // docs: compare case-insensitively
      if (status === 'SUCCEEDED' || status === 'ACCEPTED') {
        const amountMinor = decimalStringToMinor(d.amount);
        // A success with an unreadable amount can't be verified, so it goes to a human.
        if (amountMinor === null) return { ...base, type: 'payment.needs_review' };
        return { ...base, type: 'payment.succeeded', amountMinor, currency: d.currency };
      }
      // OVERPAID (and anything unexpected): never auto-issue a ticket.
      return { ...base, type: 'payment.needs_review' };
    }

    if (event.type === 'collection.failed') return { ...base, type: 'payment.attempt_failed' };

    // checkout.expired etc.: payload not confirmed from docs, so ignored.
    return { ...base, type: 'ignored' };
  }
}