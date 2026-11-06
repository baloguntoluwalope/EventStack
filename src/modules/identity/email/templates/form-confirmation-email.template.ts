import { escapeHtml } from '../../../../common/utils/escape.html.util';

export interface ConfirmationEmailOptions {
  formTitle: string;
  ticketUrl: string;
  appUrl: string;
  paid: boolean;
  answers?: { label: string; value: string }[]; // only when the submitter opted in
}

export function renderFormConfirmationEmail(o: ConfirmationEmailOptions): string {
  const rows = (o.answers ?? [])
    .map((a) => `<tr><td style="padding:6px 12px 6px 0;color:#666">${escapeHtml(a.label)}</td><td style="padding:6px 0">${escapeHtml(a.value)}</td></tr>`)
    .join('');

  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
    <h2>${o.paid ? 'Payment received. You are registered.' : 'Registration successful.'}</h2>
    <p>Thank you for registering for <strong>${escapeHtml(o.formTitle)}</strong>.</p>
    <p><a href="${escapeHtml(o.ticketUrl)}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">View your ticket</a></p>
    ${rows ? `<h3>Your responses</h3><table>${rows}</table>` : ''}
    <p style="color:#888;font-size:12px">Sent by EventStack · ${escapeHtml(o.appUrl)}</p>
  </div>`;
}