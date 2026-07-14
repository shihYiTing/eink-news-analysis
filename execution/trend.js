// SOP-03 Step 3 — Compute 7-Day Trend
// Outputs JSON on stdout: { ok: boolean, rows: object[], error?: string }
const supabase = require('./lib/supabase');

(async () => {
  try {
    const rows = await supabase.request(
      'eink_daily_reports?select=report_date,positive_count,neutral_count,negative_count,high_risk_count&order=report_date.desc&limit=7'
    );
    process.stdout.write(JSON.stringify({ ok: true, rows: rows || [] }));
  } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, error: e.message, rows: [] }));
  }
})();
