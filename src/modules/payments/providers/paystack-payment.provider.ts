import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  IPaymentProvider, PaymentChargeResult, ChargeOptions,
  NormalizedPaymentEvent, InvalidWebhookError,
} from '../../../common/providers/payment-provider.interface';

@Injectable()
export class PaystackPaymentProvider implements IPaymentProvider {
  readonly name = 'paystack';
  private readonly logger = new Logger(PaystackPaymentProvider.name);
  private readonly secretKey: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.secretKey = config.get<string>('payment.paystack.secretKey') ?? '';
    this.baseUrl = config.get<string>('payment.paystack.baseUrl') ?? 'https://api.paystack.co';
    // Fail at boot, not on the first customer's payment.
    if (!this.secretKey) {
      throw new Error('PAYMENT_PROVIDER=paystack but PAYSTACK_SECRET_KEY is not set');
    }
  }

  /** One place that talks to Paystack. Every response has the shape
   * { status: boolean, message: string, data: {...} }. */
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    const json: any = await response.json().catch(() => null);

    if (!response.ok || !json?.status) {
      this.logger.error(`Paystack ${path} failed (${response.status}): ${JSON.stringify(json)}`);
      throw new Error(json?.message ?? `Paystack request failed (${response.status})`);
    }
    return json.data as T;
  }

  async charge(amountKobo: number, currency: string, customerEmail: string, options: ChargeOptions): Promise<PaymentChargeResult> {
    const data = await this.request<{ authorization_url: string; reference: string }>(
      '/transaction/initialize',
      {
        method: 'POST',
        body: JSON.stringify({
          email: customerEmail,
          amount: amountKobo, // Paystack takes the smallest unit (kobo), same as our schema
          currency,
          reference: options.reference,
          callback_url: options.successUrl,
          metadata: options.metadata,
        }),
      },
    );
    // Initializing only creates the transaction. The money moves later,
    // on Paystack's page, so this is always 'pending' for now.
    return { reference: data.reference, status: 'pending', authorizationUrl: data.authorization_url };
  }

  async verify(reference: string): Promise<PaymentChargeResult> {
    const data = await this.request<{ status: string; reference: string; amount: number; currency: string }>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
    return { reference: data.reference, status: this.mapStatus(data.status), amount: data.amount, currency: data.currency };
  }

  /** Paystack signs every webhook using HMAC-SHA512 of the raw request body. */
  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): NormalizedPaymentEvent {
    const rawSignature = headers['x-paystack-signature'];
    const signature = Array.isArray(rawSignature) ? rawSignature[0] : rawSignature;
    if (!signature || !/^[a-f\d]{128}$/i.test(signature)) {
      throw new InvalidWebhookError('Missing or malformed Paystack signature');
    }
    const expected = createHmac('sha512', this.secretKey).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new InvalidWebhookError('Paystack signature mismatch');
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new InvalidWebhookError('Paystack webhook body is not valid JSON');
    }
    const data = payload?.data;
    if (typeof payload?.event !== 'string' || !data || typeof data !== 'object') {
      throw new InvalidWebhookError('Unexpected Paystack webhook shape');
    }

    const reference = typeof data.reference === 'string' ? data.reference : null;
    const eventId = String(data.id ?? `${payload.event}:${reference ?? 'unknown'}`);
    const base = {
      eventId,
      reference,
      providerRef: data.id == null ? null : String(data.id),
    };

    if (payload.event === 'charge.success' && data.status === 'success') {
      const amountMinor = Number(data.amount);
      return {
        ...base,
        type: Number.isSafeInteger(amountMinor) && amountMinor >= 0 ? 'payment.succeeded' : 'payment.needs_review',
        ...(Number.isSafeInteger(amountMinor) && amountMinor >= 0 ? { amountMinor } : {}),
        ...(typeof data.currency === 'string' ? { currency: data.currency } : {}),
      };
    }
    if (payload.event === 'charge.failed') return { ...base, type: 'payment.attempt_failed' };
    return { ...base, type: 'ignored' };
  }

  private mapStatus(status: string): 'success' | 'pending' | 'failed' {
    if (status === 'success') return 'success';
    if (status === 'failed' || status === 'reversed') return 'failed';
    return 'pending'; // abandoned, ongoing, pending: the payer may still finish
  }
}