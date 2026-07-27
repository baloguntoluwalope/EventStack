import { renderBaseEmail, renderButton } from './base-email.template';

export function renderPasswordResetEmail(resetUrl: string, appUrl: string): string {
  const body = `
    <h1 style="font-size:20px; color:#1a1f36; margin:0 0 12px;">Reset your password</h1>
    <p style="font-size:14px; color:#4b5065; line-height:1.6; margin:0 0 8px;">
      We received a request to reset your EventStack password.
    </p>
    ${renderButton('Reset Password', resetUrl)}
    <p style="font-size:12px; color:#8a8f98; margin:16px 0 0;">
      This link expires in 60 minutes. If you didn't request this, you can safely ignore this email.
    </p>`;
  return renderBaseEmail(body, appUrl);
}