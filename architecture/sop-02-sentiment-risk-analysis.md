# SOP-02 — Sentiment & Risk Analysis

## Purpose
For every `candidate_article` from SOP-01, produce a sentiment judgment and risk classification **from 元太科技's perspective as a company** — not the journalist's tone, not general public sentiment — so the output can function as a risk-detection signal, not just a news digest.

## Inputs
- `candidate_articles` from SOP-01 (includes any `signal_only` items)

## Outputs
- `analyzed_items`: list of `{..., sentiment, risk_level, risk_type, reasoning, quote_excerpt}`
- `analysis_flags`: list of warnings for the report footer

## Step-by-Step

### 1. Per-Article Core Claim Extraction
Read the fetched content and identify the central event/claim of the article in one sentence (e.g. "元太科技 Q2 每股盈餘低於分析師預期" or "元太科技與某品牌宣布電子紙合作案"). This is what Steps 2–4 judge — not incidental mentions of the company in an unrelated article.

### 2. Sentiment Judgment (Company Perspective)
Classify as `positive` | `neutral` | `negative` using the event's business/reputational impact on 元太科技, independent of the article's own tone:
- **Positive:** new product/partnership launch, positive earnings or analyst outlook, awards/recognition, successful contract wins, favorable regulatory outcome.
- **Negative:** lawsuits or regulatory action, product defects/recalls, missed earnings/guidance, executive departure under a cloud, analyst downgrade, losing ground to a competitor, data/security incidents, negative PR/backlash.
- **Neutral:** routine factual announcements with no clear valence (e.g. a scheduled shareholder meeting notice, a factual industry-roundup mention).

A negative-toned article can still be a positive event for the company (e.g. "外媒批評電子紙產業成長趨緩，但元太逆勢繳出成長" → positive for 元太 despite the article's negative framing of the industry). Judge the event's effect on the company, not the prose's mood.

### 3. Risk-Level Scoring
Combine sentiment magnitude with topic materiality into `low` | `medium` | `high`:
- **High:** material financial impact, active legal/regulatory exposure, product safety/quality failures, executive-level scandal, confirmed loss of a major customer/partner.
- **Medium:** negative but contained (single critical review, minor analyst caution, a competitor announcement that erodes but doesn't eliminate an advantage).
- **Low:** neutral/positive items, or negative items too minor/unconfirmed to warrant real concern (the `signal_only` bucket from SOP-01 defaults here unless content is severe enough to justify `medium`).

Positive and neutral items are typically `low` risk by definition — `risk_level` measures downside exposure, not newsworthiness.

### 4. Risk-Type Tagging
Tag each item with one or more of: `financial` | `legal_regulatory` | `product_quality` | `public_relations` | `personnel` | `competitive` | `supply_chain` | `other`. Multiple tags are fine (comma-separated) when an event spans categories (e.g. a product recall is both `product_quality` and `public_relations`).

### 5. Evidence-Backed Reasoning (No Fabrication)
Every `reasoning` string must be traceable to a specific `quote_excerpt` pulled from the fetched article — never a freestanding conclusion. If the article's claim itself reads as unattributed ("消息人士指出", "市場傳出") rather than confirmed fact, keep the sentiment/risk judgment but prefix the reasoning with `⚠️ unverified claim in source —` so downstream readers know the underlying report, not just the company's status, is uncertain.

For `signal_only` items (social/forum chatter passed through from SOP-01), never assign `high` risk on the strength of unverified chatter alone — cap at `medium`, and the reasoning must state plainly that this is unconfirmed chatter, not reported fact.

### 6. Cross-Source Consistency Check
If two or more `candidate_articles` cover the same underlying event, judge them independently (sources can disagree on framing/facts) but note in `analysis_flags` if their sentiment or key facts conflict — don't silently average them into one judgment.

### 7. Aggregate Stats for the Report
Compute counts by sentiment (`positive_count`, `neutral_count`, `negative_count`) and the list of `high` risk items — these feed directly into SOP-03's `eink_daily_reports` row and report overview block.

## Edge Cases
- **Article mentions 元太科技 only in passing** (e.g. a broad "electronic paper industry" roundup with one sentence on 元太): still classify, but keep `risk_level` low unless that one sentence is itself materially negative.
- **Satire/opinion piece, not news**: classify on the same rules, but note `analysis_flags: opinion/editorial, not a factual report` so the report reader can weight it accordingly.
- **Multiple risk types genuinely tie for primary**: tag both; don't force a single category.

## On Success
Pass `analyzed_items` and `analysis_flags` to SOP-03 (Report Compose & Deliver).
