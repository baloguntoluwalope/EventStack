export interface IEmailProvider {
  send(to: string, subject: string, htmlContent: string): Promise<void>;
}

export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';