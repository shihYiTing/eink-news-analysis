// SOP-03 Step 5 — Send Email via Gmail SMTP
// Reads JSON { subject, html } from stdin, outputs JSON on stdout:
// { sent: boolean, sent_at?: string, error?: string }
// Recipient list and sender come from .env (RECIPIENT_EMAILS, SMTP_USER) — not hardcoded.
const { loadEnv } = require('./lib/env');
loadEnv();
const { sendMail } = require('./lib/smtp');
const { readStdin } = require('./lib/read-stdin');

(async () => {
  const raw = await readStdin();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    process.stdout.write(JSON.stringify({ sent: false, error: `Invalid input JSON: ${e.message}` }));
    process.exitCode = 1;
    return;
  }

  const { subject, html } = payload;
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_APP_PASSWORD;
  const to = (process.env.RECIPIENT_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean);

  if (!host || !user || !pass || to.length === 0) {
    process.stdout.write(JSON.stringify({ sent: false, error: 'SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_APP_PASSWORD/RECIPIENT_EMAILS missing)' }));
    process.exitCode = 1;
    return;
  }

  try {
    await sendMail({ host, port, user, pass, from: user, to, subject, html });
    process.stdout.write(JSON.stringify({ sent: true, sent_at: new Date().toISOString() }));
  } catch (e) {
    process.stdout.write(JSON.stringify({ sent: false, error: e.message }));
    process.exitCode = 1;
  }
})();
