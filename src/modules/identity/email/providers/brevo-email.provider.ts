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
    const apiKey = this.config.get<string>('BREVO_API_KEY') || '';
    this.senderEmail = this.config.get<string>('SENDER_EMAIL') || '';
    this.senderName = this.config.get<string>('SENDER_NAME') || 'EventStack';

    if (!apiKey) {
      this.logger.warn('BREVO_API_KEY is not set — emails will fail to send.');
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