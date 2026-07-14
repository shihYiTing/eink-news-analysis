# SOP-01 — News Collection

## Purpose
Gather company-wide news about 元太科技 (E Ink Holdings) — technology/product, financial, legal/regulatory, personnel, and competitive — once per scheduled run, deduplicated against everything already stored, and hand off clean candidate articles for sentiment/risk analysis.

## Inputs
- `run_date`: the Taiwan local date of this run
- Supabase `eink_news_items.url` — existing records used for dedup (see `docs/schema.md`)

## Outputs
- `candidate_articles`: list of `{title, url, source, published_at, category_guess, raw_content}`
- `collection_flags`: list of warnings for the report footer

## Step-by-Step

### 0. Load Dedup Baseline
Query Supabase: `select url from eink_news_items where fetched_at > now() - interval '30 days'`. Hold this URL set in memory for the rest of the run. If this is the very first run (table empty / query fails because tables don't exist yet), treat the baseline as empty and note `⚠️ No dedup baseline — first run or Supabase not yet provisioned.`

### 1. Search Sweep
Run WebSearch across a fixed query matrix — primary entity terms crossed with topic modifiers:
- **Entity terms:** `元太科技`, `E Ink Holdings`, `E Ink`, `元太`
- **Topic modifiers:** 技術 / 新品 / 財報 / 法說 / 訴訟 / 公告 / 人事 / 股價 / 競爭對手 (run each modifier paired with an entity term — roughly 6–10 queries per day)

Window: on a normal daily run, restrict to news from the last 24–48 hours (the run cadence). On the very first run (no dedup baseline), widen to the last 7 days so the initial report isn't empty.

### 2. Dedup Against Baseline
Drop any result whose URL is already in the Step 0 baseline set. Also dedupe within this run's own results (same URL surfaced by multiple queries).

### 3. Source Credibility Filter
Keep only:
- **Credible:** official/manufacturer or brand sites (including 元太科技 investor relations / press releases), government (.gov) or academic (.edu) sources, established news outlets, recognized industry publications or analyst reports.
- **Drop:** unattributed blogs, forums, social media posts, content farms, SEO spam, promotional/affiliate pages without editorial oversight.

Edge case — social/forum chatter that looks materially significant (e.g. a viral complaint thread about a product defect): do not drop silently. Instead, keep it in a separate `signal_only` bucket, tagged `⚠️ unverified chatter — not a credible source, included for awareness only`, and pass it through to SOP-02 with that flag intact so it's never presented as confirmed news.

### 4. Fetch Full Content
WebFetch each surviving URL.
- **Success:** record full/near-full text as `raw_content`.
- **Failure** (blocked, JS-heavy, 404, timeout, paywall): mark `⚠️ Failed — {reason}` in `collection_flags`, drop from `candidate_articles`. Do not fabricate content for a failed fetch.

### 5. Category Tagging
Assign each surviving article one category: `technology_product` | `financial` | `legal_regulatory` | `personnel` | `competitive` | `other`. This is a first-pass guess — SOP-02 may refine `risk_type` independently.

### 6. Handle Zero New Results
If Step 2–4 leave zero candidate articles, this is a valid outcome (a quiet news day), not an error. Set `candidate_articles = []` and note `ℹ️ No new news since last run.` in `collection_flags` — SOP-03 still produces an (abbreviated) report so silence isn't mistaken for a broken pipeline.

## Edge Cases
- **Paywall/login-gated URL** → `⚠️ Failed — paywall/login required`. Do not guess content.
- **Non-Chinese/English source** → keep language noted; do not translate claims as if independently verified.
- **Same event covered by multiple outlets** → keep all surviving articles as separate `candidate_articles`; SOP-02 handles cross-source synthesis, don't collapse them here.
- **Article date ambiguous** (no clear publish timestamp) → set `published_at = null`, use `fetched_at` for report-date bucketing instead.

## On Success
Pass `candidate_articles` (including any `signal_only` items) and `collection_flags` to SOP-02 (Sentiment & Risk Analysis).
