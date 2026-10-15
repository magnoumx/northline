# Changelog

Notable changes, newest first. Dates are when the change shipped to production.

## 2026-10

- **Pipeline resilience.** Provider rate limits open a cooldown instead of being retried hundreds of times a day; `Retry-After` is honored; research and drafting prefer the paid provider with the free one as fallback.
- **D1 CPU budget.** The draft-candidate and opportunity-rescore queries narrow to recent rows before per-row scoring, fixing jobs that were dead-lettering on D1's per-query CPU limit.
- **Images.** Stored image URLs are normalized to hosts the Content-Security-Policy allows; unknown hosts fall back to the generated house graphic.
- **SEO and answer engines.** `llms.txt` and `llms-full.txt`, feed autodiscovery links, share images on static routes, a tighter `robots.txt`.
- **AdSense.** Publisher wiring with a verification-only mode; ad slots stay gated on consent.

## 2026-09

- **Data hygiene.** A daily job prunes expired AI request rows, failed story runs and dead trends in bounded batches; indexes on the autonomous-run tables.
- **Source authority.** First-party sources are recognized per story subject, with spoof guards.
- **Independent fact review.** Provider error bodies are captured (secrets redacted) so a failing reviewer is diagnosable.

## 2026-08

- **"Provenance" redesign.** Dark-first editorial theme, serif type scale, and a per-article source "spine".
- **Autonomous publishing.** Deterministic gates decide approval; held stories show a plain-language reason in the newsroom queue.
- **Recency gate** against stale retrospectives, and topic selection weighted by how many newsrooms are covering a story.

## 2026-07

- Initial build: public site, newsroom workspace, D1 schema and migrations, editorial state machine, sourcing and claim gates, SEO metadata, feeds and sitemaps.
