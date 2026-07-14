// SOP-01 Step 0 — Load Dedup Baseline
// Outputs JSON on stdout: { urls: string[], flags: string[] }
const supabase = require('./lib/supabase');

(async () => {
  const flags = [];
  let urls = [];
  try {
    if (!supabase.configured()) {
      flags.push('⚠️ No dedup baseline — first run or Supabase not yet provisioned.');
    } else {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const rows = await supabase.request(`eink_news_items?select=url&fetched_at=gt.${encodeURIComponent(cutoff)}`);
      urls = (rows || []).map((r) => r.url);
    }
  } catch (e) {
    flags.push(`⚠️ No dedup baseline — ${e.message}`);
  }
  process.stdout.write(JSON.stringify({ urls, flags }));
})();
