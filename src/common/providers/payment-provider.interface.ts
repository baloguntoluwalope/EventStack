export interface ChargeOptions {
  /** Our own id for this payment. Providers must echo it back in webhooks. */
  reference: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

export interface PaymentChargeResult {
  reference: string;
  /** The provider's own id (Bachs: checkout_id). */
  providerRef?: string;
  status: 'success' | 'pending' | 'failed';
  authorizationUrl?: string;
  amount?: number;   // smallest currency unit
  currency?: string;
}

/**
 * Providers translate their own webhook formats into this one shape, so
 * form and membership code never sees a provider-specific event name.
 */
export type NormalizedPaymentEventType =
  | 'payment.succeeded'
  | 'payment.attempt_failed' // NOT final: the payer may retry
  | 'payment.needs_review'   // e.g. overpaid: a human decides
  | 'ignored';

export interface NormalizedPaymentEvent {
  eventId: string;            // used for idempotency
  type: NormalizedPaymentEventType;
  reference: string | null;   // our reference
  providerRef: string | null;
  amountMinor?: number;
  currency?: string;
}

export class InvalidWebhookError extends Error {}

export interface IPaymentProvider {
  readonly name: string;

  charge(amountMinor: number, currency: string, customerEmail: string, options: ChargeOptions): Promise<PaymentChargeResult>;

  /** Throws InvalidWebhookError unless the request provably came from the provider. */
  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): NormalizedPaymentEvent;

  /** Optional: only implemented when the provider's lookup API is documented and confirmed. */
  verify?(reference: string): Promise<PaymentChargeResult>;
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';