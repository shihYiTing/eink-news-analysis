# CLAUDE.md — Eink News Monitor Project Constitution

> Last updated: 2026-07-14 | Status: Daily cloud routine `trig_015UDv6sEryiWdGc6aZm4cAH` scheduled (07:00 Asia/Taipei), code lives at github.com/shihYiTing/eink-news-analysis. First real cloud run surfaced two infra gaps: (1) Supabase host wasn't in the cloud environment's network allowlist — fix: add `mazyhjjobyvhnitrzfii.supabase.co` under Custom allowed domains; (2) Gmail SMTP can never work from a cloud routine (its egress proxy is HTTP/HTTPS-only, not just an allowlist gap) — switched email delivery to Resend's HTTPS API. | Next: add the Supabase domain to the routine's allowlist, update the routine's Environment variables (remove `SMTP_*`, add `RESEND_API_KEY`/`RESEND_FROM_EMAIL`), push the updated `send-email.js` to the repo, then re-run to confirm both Supabase writes and email delivery succeed from the cloud

---

## B.L.A.S.T. Phase Outputs

### B — Blueprint
- **North Star:** Every morning at a fixed time, automatically search the web for news about 元太科技 (E Ink Holdings) — technology, products, and company-wide activity (financial, legal/regulatory, personnel, competitive) — collect the full articles, judge each one's sentiment and risk **from the company's own perspective**, persist everything to a durable store, and deliver a readable daily report by email. This is a risk-detection tool, not a news digest: the point is surfacing what needs human attention, not volume of coverage.
- **Integrations:** Claude Code (analysis engine, no separate key). WebSearch + WebFetch for discovery and full-text collection (same credibility standard as any credible-source search: official/manufacturer sites, government/academic sources, established news and industry publications — no unattributed blogs/forums/social/content-farm content treated as fact). Supabase (system of record for raw news items + daily report history — see `docs/schema.md`). Resend (HTTPS email API, email delivery). Both external integrations are **pending credentials** — see L below.
- **Source of Truth:** Supabase (`eink_news_items`, `eink_daily_reports`) is the system of record. Local `.tmp/{date}-report.md` is a fallback-only copy written when a Supabase write fails — never treated as authoritative once Supabase is reachable again.
- **Delivery Payload:** A daily cloud-scheduled routine (fixed morning time) runs the full pipeline unattended and ends with an emailed report — no manual step required for normal operation. A manual entry point (`/scan-eink-news`) exists for ad-hoc runs and testing before the schedule is live. One run = one day's news, end to end (collection → analysis → persistence → email).
- **Behavioral Rules:** See full Behavioral Rules section below.

### L — Link
- **Supabase:** _Pending._ Needs a project provisioned; `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to be added to `.env` once available. Table DDL is specified in `docs/schema.md` but not yet executed (Architectural Invariant #1 — no `/execution/` logic until this lands).
- **Resend:** ✅ API key created (account: `oliviashih33@gmail.com`). `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (`onboarding@resend.dev`) in `.env`. Plain HTTPS API — deliberately chosen over SMTP because cloud routine environments only proxy HTTP/HTTPS egress, so raw SMTP can never reach `smtp.gmail.com` from a scheduled cloud run (confirmed 2026-07-14: `send-email.js` timed out on port 587 from inside the cloud session even with the credentials correctly configured — this was a network-protocol limit, not fixable via the environment's domain allowlist). Without a verified domain, the `onboarding@resend.dev` sender can only send to the email address the Resend account was created with, which is why the account uses `oliviashih33@gmail.com` — it must keep matching `RECIPIENT_EMAILS` (single recipient only, unless a custom domain is verified later).
  - *Note:* the Gmail API/OAuth path was evaluated and ruled out — `gmail.send` is a Google "sensitive scope," so an OAuth app in Testing status gets refresh tokens that expire every 7 days (breaks unattended daily automation), and publishing to Production requires a 3–5 day Google verification review (privacy policy, app homepage, etc.) — disproportionate for a single-recipient personal tool.
  - *Note:* Gmail SMTP + App Password was tried next and worked in principle (no OAuth, no expiry), but turned out to be a dead end for this project specifically because **both** available execution contexts block raw SMTP: the user's local corporate network blocks outbound SMTP by protocol inspection (ports 587/465), and the Anthropic cloud routine environment's egress proxy is HTTP/HTTPS-only. Revisit only if a future execution context is confirmed to allow raw SMTP egress.
  - *Note:* the company Outlook mailbox was evaluated as the sender before that and also ruled out — it's a shared/resource mailbox with no personal sign-in identity, so no self-service OAuth (delegated) path exists; only an IT-administered app-only `Mail.Send` + Application Access Policy would work, which requires a full IT request. Revisit only if that IT request is filed and approved.
- **Sender:** `onboarding@resend.dev` (Resend's shared sender, unverified-domain mode).
- **Recipient list:** `oliviashih33@gmail.com` (single address for now) — set as `RECIPIENT_EMAILS` in `.env` (see `.env.example`), not hardcoded in any SOP.
- Probe results: _TBD_ — first live Supabase write + first test email are the probes; run once credentials land.

### A — Architect
- SOPs in `/architecture/`:
  - `sop-01-news-collection.md` — search sweep, dedup against Supabase, source-credibility filter, full-text fetch
  - `sop-02-sentiment-risk-analysis.md` — company-perspective sentiment judgment, risk-level scoring, risk-type tagging, evidence-backed reasoning
  - `sop-03-report-compose-deliver.md` — persist to Supabase, compose report (today + 7-day trend), send via Resend, log outcome
- A.N.T. layer map:
  - **A (Architecture):** `/architecture/` SOPs — the "how to" for each pipeline stage
  - **N (Navigation):** `.claude/commands/scan-eink-news.md` (orchestrates SOP-01 → SOP-02 → SOP-03) — ✅ written
  - **T (Tools):** WebSearch, WebFetch (collection) — native Claude tools, no credentials needed. `/execution/` scripts for the credentialed calls: `dedup-baseline.js`, `persist-items.js`, `trend.js`, `upsert-report.js` (Supabase REST) and `send-email.js` (Resend HTTPS API) — these are the only credentialed tools in this pipeline, and all of them are plain HTTPS calls (required for cloud routine compatibility — see S note below)

### S — Stylize
- Output format: one Markdown report per day (see `sop-03-report-compose-deliver.md` Step 4 for the exact structure) — 總覽 → 🚨 高風險 Highlight → 完整清單 → 近 7 日趨勢 → 備註 — delivered as the email body, plus the same content persisted as `eink_daily_reports.report_body` for audit.
- Verify command (once credentials are live): manually invoke `/scan-eink-news` once, confirm (1) `eink_news_items` gets new rows or a clean `⚠️ no dedup baseline` note on a true first run, (2) `eink_daily_reports` gets exactly one row for that date, (3) the report email arrives with correct subject-line urgency flag, (4) a zero-news day still produces a report rather than silence.
  - *Network note (local):* the user's local corporate network blocks outbound SMTP (ports 587/465) by protocol inspection, and `git push` / SSH to GitHub are also blocked there — a manual `/scan-eink-news` run from that machine will fail at any network-bound step regardless of credentials. This is a local-machine limitation, not a credential or SOP problem.
  - *Network note (cloud):* Anthropic cloud routine environments run all outbound traffic through an HTTP/HTTPS-only security proxy — raw SMTP cannot reach `smtp.gmail.com` from there under any network-access setting (confirmed 2026-07-14: `send-email.js` timed out on port 587 even with correct credentials configured as Environment variables). This is why email delivery uses Resend's HTTPS API instead of SMTP. Non-default-allowlisted HTTPS hosts (like the Supabase project URL) still need to be added explicitly under the cloud environment's **Custom** network access → **Allowed domains**.

### T — Trigger
- Trigger mechanism: ✅ cloud-scheduled routine created — `trig_015UDv6sEryiWdGc6aZm4cAH` ("Eink News Monitor - Daily Scan"), cron `0 23 * * *` UTC = 07:00 Asia/Taipei daily. Runs on the `Default` cloud environment against the `shihYiTing/eink-news-analysis` GitHub repo (non-secret files only — `.env` is gitignored; credentials are configured as Environment variables on that cloud environment instead, since no local `.env` exists there).
- Cron / webhook / manual: cron-style daily schedule is primary; `/scan-eink-news` remains available locally for manual/ad-hoc re-runs (subject to this machine's corporate-network restrictions — see S note above, blocks SMTP/git-push/SSH). The routine can also be run on demand from https://claude.ai/code/routines/trig_015UDv6sEryiWdGc6aZm4cAH ("Run now").
- 2026-07-14 manual cloud run surfaced the Supabase-allowlist and SMTP-egress issues above; once both are fixed (allowlist + Resend switch pushed to the repo), re-run once more to confirm email actually arrives — that's the outstanding verify item before trusting the 07:00 schedule unattended.
- Maintenance notes: _TBD_ — to be filled in once the schedule has run for a few weeks (e.g. typical run duration, query-matrix tuning based on false-positive/negative rate).

---

## Data Schema

> Full column-level schema lives in `docs/schema.md` (tables `eink_news_items`, `eink_daily_reports`). Summary:

- **`eink_news_items`** — one row per collected article: url (unique, dedup key), title, source, source_credibility, published_at, fetched_at, category, sentiment, risk_level, risk_type, reasoning, quote_excerpt, raw_excerpt, report_date.
- **`eink_daily_reports`** — one row per day a report was composed: report_date (unique), total_items, positive/neutral/negative counts, high_risk_count, report_body, email_status, email_sent_at.

Report body structure is defined in `sop-03-report-compose-deliver.md` Step 4 — do not duplicate that structure here; that SOP is the single source of truth for the exact Markdown layout.

---

## Behavioral Rules

### Accuracy
- Source credibility filter (SOP-01 Step 3) applies to every collected article: official/manufacturer, government/academic, established news, recognized industry publications are credible; unattributed blogs/forums/social/content-farm/promotional content is not.
- Social/forum chatter that seems materially significant is never dropped silently, but never presented as confirmed news either — it's tagged `signal_only` / `⚠️ unverified chatter` and capped at `risk_level: medium` (SOP-01 Step 3, SOP-02 Step 5).
- **Never fabricate.** Every `reasoning` field must be traceable to a specific `quote_excerpt` from the actual fetched article — no freestanding sentiment/risk conclusions (SOP-02 Step 5).
- Unattributed claims within a source itself ("消息人士指出", "市場傳出") keep their judgment but are prefixed `⚠️ unverified claim in source —` so the reader knows the *underlying report*, not just the company's status, is uncertain.

### Sentiment & Risk Judgment
- Judge every item from **元太科技's business/reputational perspective**, not the article's own tone — a negatively-toned article can describe a positive event for the company, and vice versa (SOP-02 Step 2).
- `risk_level` measures downside exposure, not newsworthiness — positive/neutral items default to `low`.
- Conflicting coverage of the same event across multiple sources is judged independently per source, with the conflict itself flagged — never silently averaged into one verdict (SOP-02 Step 6).

### Report & Delivery
- A zero-news day still produces and sends a report (abbreviated) — a missing email must never be the only signal that the pipeline ran or didn't (SOP-01 Step 6, SOP-03 Step 4).
- High-risk items are always visible in the email subject line, not just buried in the body (SOP-03 Step 5).
- This pipeline surfaces risk signals; it does not render legal, financial, or PR-strategy advice. Every report closes with an explicit human-review disclaimer for high-risk and unverified items (SOP-03 Step 4).

### Flag / Escalation Triggers
The following must be flagged, never silently absorbed into a routine item:
- Any `risk_level: high` item — always listed in the Highlight block, always in the email subject.
- Any `signal_only` (unverified chatter) item that gets surfaced at all.
- Any cross-source factual/sentiment conflict on the same event.
- Any pipeline failure (Supabase write, email send) — surfaced via the report footer and, for email-send failures specifically, a PushNotification fallback alert so a silent delivery failure doesn't go unnoticed (SOP-03 Step 7).

---

## Architectural Invariants

1. No logic written in `/execution/` until Blueprint is complete and Data Schema is approved. *(Both were complete before `/execution/` work started; Supabase + Resend credentials landed in `.env`, `docs/ddl.sql` has been run, and the scripts + `/scan-eink-news` command are written and round-trip tested against live Supabase.)*
2. Credentials live only in `.env` — never hardcoded. Recipient email list is also a `.env` value, not hardcoded in any SOP.
3. All intermediate file operations route through `/.tmp/` (used here specifically as the Supabase-write fallback path, not general scratch space).
4. If any SOPs change, update `/architecture/` before touching `/execution/`.
5. Every output ships with a verify step (see S — Stylize above).

---

## Triggers

_TBD — documented after the daily cloud routine is actually scheduled (Phase T)._

---

## Directory Map

```
├── CLAUDE.md                              # This file — Project Constitution
├── .env                                   # Real credentials — never commit
├── .env.example                           # Template for required env vars — copy to .env, fill in once L lands
├── docs/
│   ├── schema.md                          # Supabase table schema (eink_news_items, eink_daily_reports)
│   └── ddl.sql                            # Table DDL — run once in Supabase Dashboard → SQL Editor
├── architecture/                          # Layer A: SOPs
│   ├── sop-01-news-collection.md
│   ├── sop-02-sentiment-risk-analysis.md
│   └── sop-03-report-compose-deliver.md
├── .claude/
│   └── commands/
│       └── scan-eink-news.md              # /scan-eink-news — Navigation layer, orchestrates SOP-01 → 02 → 03
├── execution/                             # Layer T: Supabase + Resend integration scripts
│   ├── lib/
│   │   ├── env.js                         # tiny .env loader
│   │   ├── supabase.js                    # PostgREST request helper
│   │   └── read-stdin.js
│   ├── dedup-baseline.js                  # SOP-01 Step 0
│   ├── persist-items.js                   # SOP-03 Step 1
│   ├── trend.js                           # SOP-03 Step 3
│   ├── upsert-report.js                   # SOP-03 Step 6
│   └── send-email.js                      # SOP-03 Step 5
└── .tmp/                                  # Ephemeral workbench + Supabase-write fallback reports
```
