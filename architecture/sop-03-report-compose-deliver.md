# SOP-03 — Report Compose & Deliver

## Purpose
Persist today's analyzed items to Supabase, compose a human-readable risk report (today's overview + 7-day trend), and deliver it by email via Gmail SMTP (app password). This is the only SOP that touches external credentials (Supabase, Gmail SMTP) — see `docs/schema.md` and CLAUDE.md → L (Link) for what's required before this SOP can actually run.

## Inputs
- `analyzed_items`, `analysis_flags` from SOP-02
- `run_date` (Taiwan local date)
- Supabase: last 7 rows of `eink_daily_reports` (for trend)

## Outputs
- New rows in `eink_news_items` (one per analyzed item, upserted on `url`)
- One new row in `eink_daily_reports`
- One email sent (or a logged failure)

## Step-by-Step

### 1. Persist to Supabase
Upsert each item in `analyzed_items` into `eink_news_items` on the `url` unique constraint (idempotent — a re-run on the same day doesn't duplicate rows). Include `signal_only` items with their `⚠️ unverified chatter` framing intact.

If the Supabase write fails (credentials missing, network error, etc.): do not abort the run. Save the composed report to a local fallback file (`.tmp/{run_date}-report.md`) so the day's work isn't lost, note the failure in the report footer, and continue to Step 4 (still attempt email — data persistence and report delivery are independent failure modes).

### 2. Compute Today's Overview
From today's `analyzed_items`: total count, sentiment breakdown (`positive_count` / `neutral_count` / `negative_count`), and the full list of `risk_level = high` items.

### 3. Compute 7-Day Trend
Query: `select report_date, positive_count, neutral_count, negative_count, high_risk_count from eink_daily_reports order by report_date desc limit 7`. If fewer than 7 rows exist (early days of the pipeline), use what's available and note `ℹ️ Trend based on {N} day(s) — history still building.`

### 4. Compose Report
Structure (Markdown, converted to email-safe HTML at send time):

```markdown
# 元太科技新聞風險日報 — {run_date}

## 總覽
- 今日新聞則數：{total_items}
- 情緒分布：正面 {positive_count} ／中立 {neutral_count} ／負面 {negative_count}
- 🚨 高風險項目：{high_risk_count} 則

## 🚨 高風險 Highlight
{for each risk_level=high item: 標題、來源、連結、風險類型、判讀理由（含引用原文片段）}
（若無高風險項目：「今日無高風險項目。」）

## 完整清單
{for each item, grouped by category: 標題、來源、發布日期、連結、情緒判定、風險等級、風險類型、判讀理由}

## 近 7 日趨勢
{simple trend line/table: date → positive/neutral/negative/high_risk counts}

## 備註
{collection_flags + analysis_flags, or "無"}
{data source disclaimer: "本報告由 AI 自動蒐集與判讀，高風險項目與未查證內容請人工複核後再採取行動。"}
```

If `total_items = 0` (SOP-01 Step 6's quiet-day case): still send the report, with the overview reading "今日無新增可信新聞" and the rest of the sections abbreviated accordingly — a missing email should never be the only signal that the pipeline ran.

### 5. Send Email
Send via Gmail SMTP (`smtp.gmail.com:587`) using the credentials in `.env` (`SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_APP_PASSWORD`). Subject line format: `[元太新聞風險日報] {run_date}{ — 🚨N 則高風險 if high_risk_count > 0}` so urgency is visible without opening the email. Recipient list is configured in `.env` (not hardcoded in this SOP).

### 6. Write `eink_daily_reports` Row
Regardless of email outcome, write one row: `report_date`, the four counts, `report_body` (the full composed Markdown, for audit), `email_status` (`sent` | `failed` | `skipped`), `email_sent_at` if applicable.

### 7. Failure Handling
- **Supabase write failed, email succeeded:** email still goes out (Step 1's local fallback file covers the data-loss risk); flag in report footer.
- **Email failed, Supabase write succeeded:** data isn't lost, but surface the failure — use PushNotification as a fallback alert so a silent email failure doesn't go unnoticed for days.
- **Both failed:** PushNotification alert + local fallback file is the last line of defense; this is a "check the pipeline" situation, not a normal day's flag.

## Edge Cases
- **Same-day re-run** (e.g. manual re-trigger after fixing a credential issue): upserts in Step 1 prevent duplicate news rows; Step 6 should update the existing `eink_daily_reports` row for that `report_date` rather than inserting a second one for the same day.
- **Trend query returns conflicting/malformed rows** (e.g. schema drift): don't fail the whole report — omit the trend section and note `⚠️ Trend unavailable this run.`

## On Success
Confirm in the run's terminal/log output: Supabase write status, email delivery status, and the report's headline stats (total items, high-risk count).
