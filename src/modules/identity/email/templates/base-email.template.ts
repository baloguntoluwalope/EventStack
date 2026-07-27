/**
 * Shared branded shell every transactional email renders inside.
 * Change the brand colors/logo/footer once here — every email updates.
 */
export function renderBaseEmail(bodyHtml: string, appUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0; padding:0; background-color:#f4f5f7; font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7; padding:32px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden;">
          <tr>
            <td style="background-color:#1a1f36; padding:24px 32px;">
              <span style="color:#ffffff; font-size:20px; font-weight:700; letter-spacing:-0.02em;">EventStack</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px; background-color:#f9fafb; border-top:1px solid #eef0f3;">
              <p style="margin:0; font-size:12px; color:#8a8f98; line-height:1.5;">
                You're receiving this because you have an account on EventStack.
                <br />
                <a href="${appUrl}" style="color:#8a8f98; text-decoration:underline;">${appUrl.replace(/^https?:\/\//, '')}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export function renderButton(label: string, url: string): string {
  return `
<a href="${url}" style="display:inline-block; background-color:#5b5fef; color:#ffffff; text-decoration:none; font-size:14px; font-weight:600; padding:12px 24px; border-radius:8px; margin:16px 0;">
  ${label}
</a>`.trim();
}