import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StubPaymentProvider } from './providers/stub-payment.provider';
import { PaystackPaymentProvider } from './providers/paystack-payment.provider';
import { BachsPaymentProvider } from './providers/bachs-payment.provider';
import { PAYMENT_PROVIDER } from '../../common/providers/payment-provider.interface';

@Global()
@Module({
  providers: [
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        switch (config.get<string>('payment.provider')) {
          case 'bachs': return new BachsPaymentProvider(config);
          case 'paystack': return new PaystackPaymentProvider(config);
          default: return new StubPaymentProvider();
        }
      },
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentsModule {}