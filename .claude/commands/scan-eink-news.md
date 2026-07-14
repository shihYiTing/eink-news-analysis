---
description: Run one full day's Eink News Monitor pipeline — collect, analyze, persist, and email the 元太科技 risk report.
---

# /scan-eink-news

Orchestrates SOP-01 → SOP-02 → SOP-03 end to end, exactly as specified in `architecture/`. Read all three SOPs in full before starting — this command only tells you *when* to call the credentialed scripts in `execution/`; the actual collection, judgment, and composition logic is defined in those SOPs and must be followed precisely, not re-derived here.

## 0. Setup
- Compute `run_date` (Asia/Taipei, which has no DST — UTC+8 always): `node -e "console.log(new Date(Date.now()+8*3600*1000).toISOString().slice(0,10))"`
- Run `node execution/dedup-baseline.js` and parse its JSON stdout (`{urls, flags}`). Carry `urls` forward as the dedup set for SOP-01 Step 2, and `flags` into `collection_flags`.

## 1. SOP-01 — News Collection
Follow `architecture/sop-01-news-collection.md` Steps 1–6 exactly (search sweep query matrix, dedup against the baseline set from Step 0, source-credibility filter, WebFetch full text, category tagging, zero-results handling). Produce `candidate_articles` and `collection_flags`.

## 2. SOP-02 — Sentiment & Risk Analysis
Follow `architecture/sop-02-sentiment-risk-analysis.md` Steps 1–7 exactly for every item in `candidate_articles` (including `signal_only` items). Produce `analyzed_items` (each with `sentiment`, `risk_level`, `risk_type`, `reasoning`, `quote_excerpt`) and `analysis_flags`. Compute the aggregate counts (`positive_count`, `neutral_count`, `negative_count`, `high_risk_count`).

## 3. SOP-03 — Report Compose & Deliver
Follow `architecture/sop-03-report-compose-deliver.md`. Concretely, using the credentialed scripts:

**Step 1 — Persist items.** Map each `analyzed_item` to the `eink_news_items` columns (`url, title, source, source_credibility, published_at, category, sentiment, risk_level, risk_type, reasoning, quote_excerpt, raw_excerpt, report_date`) and pipe the JSON array into:
```
node execution/persist-items.js
```
If it returns `{ok: false}`: do NOT abort. Write the composed report (see Step 4 below) to `.tmp/{run_date}-report.md` as the fallback copy, and note the failure in the report's 備註 section. Continue to email regardless — persistence and delivery are independent failure modes (SOP-03 Step 7).

**Step 3 — 7-day trend.** Run:
```
node execution/trend.js
```
Parse `{ok, rows}`. If fewer than 7 rows, note `ℹ️ Trend based on {N} day(s) — history still building.` If the call errors, omit the trend section and note `⚠️ Trend unavailable this run.`

**Step 4 — Compose the report.** Write the report in the exact structure defined in SOP-03 Step 4 (總覽 → 🚨 高風險 Highlight → 完整清單 → 近 7 日趨勢 → 備註), in **both**:
- Markdown (this is what gets persisted as `report_body` and, on Supabase-write failure, the `.tmp/` fallback file)
- A simple semantic-HTML version with equivalent content (`<h1>`/`<h2>`/`<ul><li>`/`<strong>`/`<a href>`/`<hr>`/`<p>` — no external CSS/JS/images), for the email body

Both must carry the same facts; they don't need to be byte-identical.

**Step 5 — Send email.** Subject: `[元太新聞風險日報] {run_date}` + (` — 🚨{N} 則高風險` if `high_risk_count > 0`). Pipe `{"subject": "...", "html": "..."}` into:
```
node execution/send-email.js
```
If it returns `{sent: false}`: use the **PushNotification** tool to alert that today's email delivery failed (include the error and `run_date`) — a silent email failure must never go unnoticed (SOP-03 Step 7 / CLAUDE.md Flag/Escalation Triggers).

**Step 6 — Write the daily report row.** Regardless of email outcome, pipe the row JSON (`report_date, total_items, positive_count, neutral_count, negative_count, high_risk_count, report_body` [the Markdown], `email_status` [`sent`|`failed`|`skipped`], `email_sent_at`) into:
```
node execution/upsert-report.js
```
This upserts on `report_date`, so a same-day re-run updates the existing row rather than duplicating it.

## 4. Report Back
Per SOP-03 "On Success": state plainly in your final response — Supabase write status, email delivery status, and the headline stats (total items, high-risk count). If both Supabase and email failed, say so clearly; per SOP-03 Step 7 that's a "check the pipeline" situation, not a normal day's flag, and PushNotification should already have fired for the email side.

## Notes
- Local ad-hoc runs on a network with corporate TLS/SMTP restrictions may fail at the Supabase or email step for network reasons unrelated to credentials — see CLAUDE.md → S (Stylize) network note before assuming credentials are wrong.
- Never fabricate `candidate_articles` content, `reasoning`, or `quote_excerpt` — every judgment must trace to real fetched text (CLAUDE.md → Behavioral Rules → Accuracy).
