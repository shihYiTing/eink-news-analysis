-- Eink News Monitor — table DDL (see docs/schema.md for column-level notes)
-- Run this once in Supabase Dashboard → SQL Editor. Safe to re-run (uses IF NOT EXISTS).

create table if not exists eink_news_items (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  title text not null,
  source text,
  source_credibility text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  category text,
  sentiment text,
  risk_level text,
  risk_type text,
  reasoning text,
  quote_excerpt text,
  raw_excerpt text,
  report_date date,
  created_at timestamptz not null default now()
);

create index if not exists idx_eink_news_items_report_date on eink_news_items (report_date);
create index if not exists idx_eink_news_items_risk_level on eink_news_items (risk_level);

create table if not exists eink_daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null unique,
  total_items int not null default 0,
  positive_count int not null default 0,
  neutral_count int not null default 0,
  negative_count int not null default 0,
  high_risk_count int not null default 0,
  report_body text,
  email_status text,
  email_sent_at timestamptz,
  created_at timestamptz not null default now()
);
