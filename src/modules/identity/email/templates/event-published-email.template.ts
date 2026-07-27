import { renderBaseEmail, renderButton } from './base-email.template';

export function renderEventPublishedEmail(eventTitle: string, eventUrl: string, appUrl: string): string {
  const body = `
    <h1 style="font-size:20px; color:#1a1f36; margin:0 0 12px;">Your event is live 🎉</h1>
    <p style="font-size:14px; color:#4b5065; line-height:1.6; margin:0 0 8px;">
      <strong>${eventTitle}</strong> has been published and is ready to share.
    </p>
    ${renderButton('View Event Page', eventUrl)}`;
  return renderBaseEmail(body, appUrl);
}