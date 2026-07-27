import { renderBaseEmail, renderButton } from './base-email.template';

export function renderVerificationEmail(name: string, verifyUrl: string, appUrl: string): string {
  const body = `
    <h1 style="font-size:20px; color:#1a1f36; margin:0 0 12px;">Verify your email</h1>
    <p style="font-size:14px; color:#4b5065; line-height:1.6; margin:0 0 8px;">
      Hi ${name || 'there'},
    </p>
    <p style="font-size:14px; color:#4b5065; line-height:1.6; margin:0 0 8px;">
      Confirm your email address to activate your EventStack account and start publishing event websites.
    </p>
    ${renderButton('Verify Email', verifyUrl)}
    <p style="font-size:12px; color:#8a8f98; margin:16px 0 0;">
      This link expires in 60 minutes. If you didn't create this account, you can ignore this email.
    </p>`;
  return renderBaseEmail(body, appUrl);
}