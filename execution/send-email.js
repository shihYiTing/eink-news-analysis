// SOP-03 Step 5 — Send Email via Resend (HTTPS API, no SMTP/OAuth)
// Reads JSON { subject, html } from stdin, outputs JSON on stdout:
// { sent: boolean, sent_at?: string, error?: string }
// Recipient list and sender come from .env (RECIPIENT_EMAILS, RESEND_FROM_EMAIL) — not hardcoded.
const { loadEnv } = require('./lib/env');
loadEnv();
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
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = (process.env.RECIPIENT_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean);

  if (!apiKey || !from || to.length === 0) {
    process.stdout.write(JSON.stringify({ sent: false, error: 'Resend not configured (RESEND_API_KEY/RESEND_FROM_EMAIL/RECIPIENT_EMAILS missing)' }));
    process.exitCode = 1;
    return;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Resend API ${res.status}: ${text}`);
    }
    process.stdout.write(JSON.stringify({ sent: true, sent_at: new Date().toISOString() }));
  } catch (e) {
    process.stdout.write(JSON.stringify({ sent: false, error: e.message }));
    process.exitCode = 1;
  }
})();
