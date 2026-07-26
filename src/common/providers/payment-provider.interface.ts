export interface PaymentChargeResult {
  reference: string;
  status: 'success' | 'pending' | 'failed';
}

export interface IPaymentProvider {
  charge(amountKobo: number, currency: string, customerEmail: string): Promise<PaymentChargeResult>;
  verify(reference: string): Promise<PaymentChargeResult>;
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';