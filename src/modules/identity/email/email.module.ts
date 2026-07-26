import { Module } from '@nestjs/common';
import { BrevoEmailProvider } from './providers/brevo-email.provider';
import { EMAIL_PROVIDER } from '../../../common/providers/email-provider.interface';

@Module({
  providers: [{ provide: EMAIL_PROVIDER, useClass: BrevoEmailProvider }],
  exports: [EMAIL_PROVIDER],
})
export class EmailModule {}