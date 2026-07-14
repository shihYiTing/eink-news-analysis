# Eink News Monitor — Supabase Schema

> Data store for this pipeline. Unlike a pure-local-file pipeline, this agent persists to Supabase so history/trend analysis survives across daily runs. Schema is approved as of this doc's creation; credentials (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) are still pending — see CLAUDE.md → L (Link).

---

## Table: `eink_news_items`

One row per collected news item, written by SOP-03 Step 1 after SOP-02 analysis.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, `default gen_random_uuid()` |
| `url` | `text` | **unique, not null** — the dedup key SOP-01 Step 0 checks against |
| `title` | `text` | not null |
| `source` | `text` | outlet/site name |
| `source_credibility` | `text` | `official` \| `news` \| `industry` \| `gov_academic` \| `other` |
| `published_at` | `timestamptz` | nullable — some sources don't expose a reliable timestamp |
| `fetched_at` | `timestamptz` | `default now()` — when SOP-01 pulled it |
| `category` | `text` | `technology_product` \| `financial` \| `legal_regulatory` \| `personnel` \| `competitive` \| `other` |
| `sentiment` | `text` | `positive` \| `neutral` \| `negative` — from the company's POV, see SOP-02 |
| `risk_level` | `text` | `low` \| `medium` \| `high` |
| `risk_type` | `text` | comma-separated tags, e.g. `financial,legal` — see SOP-02 Step 4 for the tag list |
| `reasoning` | `text` | why this sentiment/risk was assigned — must reference the quote below, never freestanding |
| `quote_excerpt` | `text` | the specific sentence(s) the reasoning is based on; empty only if `sentiment = neutral` and nothing quotable |
| `raw_excerpt` | `text` | short excerpt of the fetched article (not full text — keep rows lean) |
| `report_date` | `date` | which daily report this row belongs to (Taiwan local date) |
| `created_at` | `timestamptz` | `default now()` |

**Indexes:** unique index on `url` (dedup + upsert target), index on `report_date` (trend queries), index on `risk_level` (high-risk filtering).

---

## Table: `eink_daily_reports`

One row per day a report was composed, written by SOP-03 Step 5–6. Audit trail + trend query source, independent of whether the email actually sent.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, `default gen_random_uuid()` |
| `report_date` | `date` | **unique, not null** |
| `total_items` | `int` | count of `eink_news_items` rows for this `report_date` |
| `positive_count` / `neutral_count` / `negative_count` | `int` | sentiment breakdown |
| `high_risk_count` | `int` | rows where `risk_level = 'high'` |
| `report_body` | `text` | the composed report (markdown), for audit even if email delivery fails |
| `email_status` | `text` | `sent` \| `failed` \| `skipped` |
| `email_sent_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | `default now()` |

---

## Dedup & Trend Query Patterns

- **Dedup baseline (SOP-01 Step 0):** `select url from eink_news_items where fetched_at > now() - interval '30 days'`
- **7-day trend (SOP-03 Step 3):** `select report_date, positive_count, neutral_count, negative_count, high_risk_count from eink_daily_reports order by report_date desc limit 7`

---

## Open Items Before This Can Run

1. ✅ Supabase project provisioned, `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` added to `.env`.
2. Both tables created in Supabase — DDL is in `docs/ddl.sql`. The REST API (PostgREST) has no generic "run arbitrary SQL" endpoint, so this one-time step has to be run manually in Supabase Dashboard → SQL Editor; it can't be scripted with the credentials this project holds (service_role key authenticates REST/Auth, not DDL execution).
3. Row-level security: since this pipeline writes via a service-role key from a trusted cloud routine (not a public client), RLS can stay permissive on these two tables — no user-facing access expected.
