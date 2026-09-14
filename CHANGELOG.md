# Changelog

## 0.1.0 — 2026-07-24

### Added

- Complete responsive public-news and Newsroom OS reference frontend
- Story Intelligence, live blog, standard article, trend, search, newsletter,
  topic, directory, account, policy, and system-state surfaces
- Explainable editorial scoring, claim gates, sensitive routing, source tiers,
  deduplication, state transitions, permissions, and tests
- D1 schema and newsletter consent endpoint
- SEO metadata, structured data, feeds, and sitemap infrastructure
- Competitor research, product specification, architecture, policy, security,
  operations, and launch documentation

### Safety

- Auto-publication remains disabled
- Sensitive content requires human approval
- Fictional seed content is labeled across product surfaces
- Advertising and live third-party connectors are not activated

## V9 production wiring
- Connected GDELT trend ingestion and D1 opportunity scoring to durable jobs.
- Added authenticated AI review-package orchestration and newsroom analytics summary APIs.
- Connected article-audio queue execution to R2 and OpenAI TTS transport.
- Added V9 production blocker and operations documentation.

## 0.2.0 — Production candidate

- Added production-safe CMS draft, claim verification, human review, approval, publication, and correction workflows.
- Added protected source, media quarantine, newsletter issue, analytics, jobs, audit, staff, role, and integration operations.
- Added unified multi-briefing newsletter double opt-in.
- Added Cloudflare production provisioning, runtime bundle, readiness, and release verification tooling.
- Removed production fallback to fictional fixtures and added explicit empty states.
- Added migrations 0008 and 0009.

## 0.3.0 — V12 Launch Candidate

- Fixed Cloudflare Workers fetch compatibility by using `redirect: "manual"` across Access, AI, GDELT, and Google Trends adapters; updated stale provider tests.
- Added Google Trends U.S. Trending Now RSS discovery alongside GDELT and persisted provenance-rich trend observations.
- Added bounded Anthropic web search with domain controls and source URL preservation.
- Added controlled `approved_only` automatic publication every 15 minutes, with low-risk, non-sensitive, category/format allowlists, audit actor, idempotency, and daily limits.
- Added Google Search Console verification metadata, Google launch validation, guarded AdSense loader, normalized dynamic `ads.txt`, and conditional CSP origins.
- Added real-content readiness floor and controlled indexing/AdSense gates.
- Added V12 Arabic launch, SEO/AdSense, Claude/Trends, and automation runbooks.
- Fixed one-time owner bootstrap on Windows and remote D1 by using `npx.cmd` and transaction-free idempotent SQL.
