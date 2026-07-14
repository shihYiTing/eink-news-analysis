// SOP-03 Step 1 — Persist analyzed items to Supabase (upsert on url)
// Reads JSON array from stdin, outputs JSON on stdout: { ok: boolean, upserted?: number, error?: string }
const supabase = require('./lib/supabase');
const { readStdin } = require('./lib/read-stdin');

(async () => {
  const raw = await readStdin();
  let items;
  try {
    items = JSON.parse(raw);
  } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, error: `Invalid input JSON: ${e.message}` }));
    process.exitCode = 1;
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    process.stdout.write(JSON.stringify({ ok: true, upserted: 0 }));
    return;
  }

  try {
    await supabase.request('eink_news_items?on_conflict=url', {
      method: 'POST',
      body: items,
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
    process.stdout.write(JSON.stringify({ ok: true, upserted: items.length }));
  } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, error: e.message }));
    process.exitCode = 1;
  }
})();
