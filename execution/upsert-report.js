// SOP-03 Step 6 — Write eink_daily_reports row (upsert on report_date so a
// same-day re-run updates the existing row instead of inserting a second one)
// Reads a single JSON object from stdin, outputs JSON on stdout: { ok: boolean, error?: string }
const supabase = require('./lib/supabase');
const { readStdin } = require('./lib/read-stdin');

(async () => {
  const raw = await readStdin();
  let row;
  try {
    row = JSON.parse(raw);
  } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, error: `Invalid input JSON: ${e.message}` }));
    process.exitCode = 1;
    return;
  }

  try {
    await supabase.request('eink_daily_reports?on_conflict=report_date', {
      method: 'POST',
      body: [row],
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
    process.stdout.write(JSON.stringify({ ok: true }));
  } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, error: e.message }));
    process.exitCode = 1;
  }
})();
