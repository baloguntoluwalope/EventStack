import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient, BrevoError } from '@getbrevo/brevo';

import type { IEmailProvider } from '../../../../common/providers/email-provider.interface';

@Injectable()
export class BrevoEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(BrevoEmailProvider.name);
  private readonly client: BrevoClient;
  private readonly senderEmail: string;
  private readonly senderName: string;

  constructor(private readonly config: ConfigService) {
    const apiKey =
      this.config.get<string>('email.brevoApiKey') ||
      this.config.get<string>('BREVO_API_KEY') ||
      '';

    this.senderEmail =
      this.config.get<string>('email.senderEmail') ||
      this.config.get<string>('SENDER_EMAIL') ||
      this.config.get<string>('EMAIL_SENDER_ADDRESS') ||
      '';

    this.senderName =
      this.config.get<string>('email.senderName') ||
      this.config.get<string>('SENDER_NAME') ||
      'EventStack';

    if (!apiKey || !this.senderEmail) {
      this.logger.warn(
        'Brevo email config is incomplete — set email.brevoApiKey and email.senderEmail (or the legacy BREVO_API_KEY / EMAIL_SENDER_ADDRESS env vars).',
      );
    }

    // Initialize the unified Brevo client
    this.client = new BrevoClient({ apiKey });
  }

  async send(to: string, subject: string, htmlContent: string): Promise<void> {
    try {
      await this.client.transactionalEmails.sendTransacEmail({
        sender: { name: this.senderName, email: this.senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent,
      });

      this.logger.log(`Email successfully sent via Brevo SDK to ${to}`);
    } catch (error) {
      const errorMsg =
        error instanceof BrevoError
          ? `${error.statusCode}: ${error.message}`
          : error instanceof Error
            ? error.message
            : String(error);

      this.logger.error(`Brevo SDK send failed for ${to}: ${errorMsg}`);
      throw new Error(`Brevo SDK send failed: ${errorMsg}`);
    }
  }
}