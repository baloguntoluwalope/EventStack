import { renderBaseEmail, renderButton } from './base-email.template';

export function renderInvitationEmail(orgName: string, acceptUrl: string, appUrl: string): string {
  const body = `
    <h1 style="font-size:20px; color:#1a1f36; margin:0 0 12px;">You've been invited</h1>
    <p style="font-size:14px; color:#4b5065; line-height:1.6; margin:0 0 8px;">
      You've been invited to join <strong>${orgName}</strong> on EventStack.
    </p>
    ${renderButton('Accept Invitation', acceptUrl)}
    <p style="font-size:12px; color:#8a8f98; margin:16px 0 0;">
      This invitation expires in 7 days.
    </p>`;
  return renderBaseEmail(body, appUrl);
}