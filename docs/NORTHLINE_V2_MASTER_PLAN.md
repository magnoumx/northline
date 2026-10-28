# Northline V2: master plan

Canonical plan for the V2 program. One document, updated at the end of every sprint. Facts marked **verified** were checked in code or against production (read-only) on the date given; everything else is a plan or an assumption and says so.

Last updated: 2026-10-29 (Sprint 0).

## Progress tracker

| # | Workstream | Priority | Status | Next sprint |
|---|---|---|---|---|
| 01 | Infrastructure / Cloudflare | P0 | Sprint 0 fixes in PR, not deployed | 1 |
| 02 | Trend intelligence | P1 | Not started (cost finding logged) | 2 |
| 03 | Research / fact check | P1 | Not started | 2 |
| 04 | AI publishing engine | P0 | Sprint 0 fixes in PR, not deployed | 1 |
| 05 | Newsroom / CMS | P0 | Backlog listed, no action | 1 |
| 06 | Technical SEO / indexing | P1 | Baseline only | 2 |
| 07 | Content SEO | P2 | Not started | 3 |
| 08 | UI / UX | P2 | Not started (after publishing is stable) | 3 |
| 09 | Performance / accessibility | P2 | Baseline only (TTFB ~1.5 s) | 3 |
| 10 | News / distribution | P1 | Blocked by no publishing | 2 |
| 11 | AdSense | P3 | Blocked (needs steady publishing + named authors) | 4 |
| 12 | Analytics / retention / security | P2 | Not started | 3 |

Sprint order: **0** stop the bleeding (done in PR) → **1** restore publishing safely → **2** trust, SEO and distribution → **3** redesign, performance, analytics → **4** monetization.

## Reconciled state (verified 2026-10-29)

- `docs/CLAUDE_HANDOFF.md` said the D1 fix was "not on GitHub `main` yet". Stale: `5861c52` merged via PR #1 (`5c30d92`). `main` is `7a235d0`. Production `49a31276` (deployed 2026-10-28 22:12 UTC) was built from `5861c52`, so production equals `main` minus the Phase 1 cleanup (dead code only). Handoff updated.
- Last article published: 2026-10-14 23:31 UTC. Nothing since.
- Backlog: 14 articles in `HUMAN_REVIEW_REQUIRED` (10 US_NEWS, 2 BUSINESS, 2 SPORTS; all MEDIUM risk, none flagged sensitive; Oct 26-28) and 7 `APPROVED` but never published (3 SPORTS, 2 WEATHER, 1 TECHNOLOGY, 1 US_NEWS; Sept 5-14, now six weeks old).

## Cross-cutting rules

- No publishing, mass retry, production D1 writes, migrations, billing changes or deploys without explicit owner approval.
- No fabricated bylines, reporting, sources, photos or interviews. Political, health, legal and financial stories need human approval. Trend popularity alone never triggers publication.
- Indexing API is not used for ordinary news (Google restricts it to job postings and livestream video). Use sitemaps, the news sitemap and IndexNow.
- Unknown Search Console / GA4 numbers are reported as unknown, never as zero.
- Never promise AdSense approval or rankings.
- Skills: use what is already installed (list below). Inspect any new skill's source before installing; no redundant packs, no agent swarms.

## Installed skills, by assignment

| Skill | Workstreams |
|---|---|
| `systematic-debugging`, `debugging-root-cause`, `tdd`, `verification-before-completion` | 01, 04, 05 (every bug fix) |
| `regression-blast-radius`, `code-review`, `security-review`, `sechelix` | Every PR touching jobs, editorial writes, auth, payments-like flows |
| `seo-technical`, `seo-sitemap`, `seo-schema`, `seo-google`, `seo-audit` | 06 |
| `seo-content`, `seo-cluster`, `seo-content-brief`, `seo-geo` | 07, 10 |
| `impeccable`, `frontend-design`, `ui-ux-pro-max`, `anti-ai-slop-ui`, `design-review` | 08 |
| `web-perf`, `accessibility-audit`, `seo-performance` | 09 |
| `research`, `search-first-feature` | 02, 03 |
| `release-quality-gate` | Any production deploy |

Not installed and not needed for now: extra SEO toolkits (the `seo-*` family covers it). Re-evaluate `claude-blog`-style skills only if 07 needs a content workflow the installed skills lack, and read their source first.

---

## 01 Infrastructure / Cloudflare

- **Modules:** `worker/index.ts` (fetch, scheduled, queue), `wrangler.jsonc`, `lib/jobs/executors.ts`, `lib/jobs/*` (schedules), `lib/runtime`, `scripts/check-infrastructure.mjs`, `scripts/backup.mjs`, `scripts/restore.mjs`.
- **Verified problems:**
  - D1 `northline-production` is 944 MB (above the 500 MB Free limit), so Workers Paid is required.
  - The October invoice came from `backfillArticleVideos` (correlated `LIKE` over `audit_logs`, 69.2B rows in 31 days). Fixed and deployed (`49a31276`).
  - **New, Sprint 0:** the video backfill leaks a draft version on every failed attempt. 22,810 orphan drafts on 61 articles; one article has 4,270 versions. That is about half of `article_versions` (~287 MB). The cause is in 04; cleanup is below.
  - Remaining top reads (1-day insights, which still include the pre-deploy hours): trend selection ~19M rows/day (54 runs, ~360k rows each; `lib/jobs/executors.ts`), hero-media backfill scan ~11M/day, `article_topics` IN-lists ~6M/day. Workers Paid includes 25B reads/month, so these cost $0 extra today. They matter only for headroom and latency.
- **Tasks:**
  1. Deploy the Sprint 0 PR (approval needed).
  2. Run `scripts/ops/cleanup-leaked-media-drafts.sql` after a Time Travel bookmark (approval needed).
  3. After a full post-deploy day, re-read `wrangler d1 insights --timePeriod 1d` and record the real daily reads.
  4. Add indexes or a cursor for the trend selection and hero scan (Sprint 2, measured first).
  5. Add a CI guard that fails on a correlated `LIKE '%' || ... || '%'` against `audit_logs`.
- **Tests:** source-shape tests (as in `tests/jobs/video-backfill.test.ts`), plus D1 insights before and after.
- **Safety:** cleanup runs in 500-row batches, published versions are protected by triggers, and there is a restore bookmark.
- **Cost:** Workers Paid $5/month base. Cleanup frees ~287 MB but the DB stays above 500 MB, so there is no move back to Free.
- **Acceptance:** after deploy, no new orphan drafts for 24 h; daily D1 reads recorded.
- **PR boundary:** infra and job-cost changes separate from editorial logic.
- **Done:** zero orphan drafts, reads per day documented, guard in CI.

## 02 Trend intelligence

- **Modules:** `lib/intelligence/trend-intelligence.ts`, `lib/editorial/trend-scoring.ts`, `lib/editorial/candidate-selection.ts`, `lib/editorial/topic-derivation.ts`, `lib/intelligence/opportunity-engine.ts`, `app/newsroom/trends`.
- **Verified problems:** ~170 runs in 14 days failed with `AUTONOMOUS_TOPIC_NOT_REPORTABLE` (0 primary sources): the selector picks search terms without news behind them. Trend selection is the largest remaining D1 reader.
- **Tasks:** require source velocity of at least 2 independent outlets before a trend becomes a candidate; cache the scored candidate list per cron tick; record why a trend was rejected.
- **Tests:** unit tests on scoring with fixtures; regression test that a 0-source trend is never queued.
- **Safety:** popularity alone never queues a draft (policy rule).
- **Acceptance:** `TOPIC_NOT_REPORTABLE` share falls below 10% of runs.
- **Done:** fewer wasted AI calls, documented rejection reasons.

## 03 Research / fact check

- **Modules:** `lib/source-acquisition/*`, `lib/editorial/claims.ts`, `lib/editorial/source-authority.ts`, `lib/editorial/source-tiers.ts`, `lib/editorial/sensitive-content.ts`, `docs/SOURCE_POLICY.md`.
- **Verified problems:** none confirmed in Sprint 0. Earlier evidence (test comment in `tests/editorial/media-revision.test.ts`): media revisions once dropped source links; fixed by copy-forward.
- **Tasks:** audit claim-to-evidence coverage on the 14 review articles (read-only); make sure sensitive categories always route to human review.
- **Acceptance:** every published claim has at least one evidence row; sensitive stories never auto-publish.

## 04 AI publishing engine

- **Modules:** `lib/ai/gateway.ts`, `lib/ai/providers.ts`, `lib/ai/resilience.ts`, `lib/ai/errors.ts`, `lib/editorial/autonomous-newsroom.ts`, `lib/editorial/ai-workflow.ts`, `lib/editorial/media-revision.ts`, `lib/editorial/article-write-service.ts`, `lib/jobs/executors.ts`.
- **Verified problems and Sprint 0 status:** see "Sprint 0 results" below. In short: daily-quota 429s were retried hourly; the media revision cleanup broke on RESTRICT foreign keys; write conflicts were masked. The `ai_tasks` ledger has 0 rows in 7 days, so per-provider usage and cost are not observable.
- **Tasks (Sprint 1):** fix the `ai_tasks` ledger gap; record the provider on every failure; per-provider cooldown (today a cooldown pauses all autodrafting even if another provider has quota); read the per-task chain values (secret names `AI_DRAFTING_CHAIN`, `AUTONOMOUS_AI_*_CHAIN`) with the owner to confirm routing.
- **Safety:** no mass retry of the 609 failed runs. Retry only individually selected, still-newsworthy trends.
- **Cost:** depends on the provider decision (owner). Paid quota or a second provider removes the daily ceiling.
- **Acceptance:** at least one autonomous run per day reaches REVIEW_REQUIRED or COMPLETED for 7 days.

## 05 Newsroom / CMS

- **Modules:** `app/newsroom/*` (review, editor, cockpit, settings), `components/newsroom*`, `lib/editorial/state-machine.ts`, `lib/newsroom`, `app/api/newsroom/*`.
- **Verified problems:** 14 stories wait in review and 7 approved stories were never published. Why approved stories never publish is unknown; `article.autopublish` runs (`selected` diagnostics on 2026-10-28) but publishes nothing.
- **Tasks:** diagnose the autopublish selection read-only; give editors a "stale, do not publish" path for the six-week-old APPROVED items; show the real failure reason (now carried in the write-conflict message) in the cockpit.
- **Safety:** the owner decides each of the 21 stories; nothing publishes automatically from this work.
- **Acceptance:** an editor can clear the backlog from the UI.

## 06 Technical SEO / indexing

- **Modules:** `app/sitemap.xml`, `app/sitemaps/*`, `app/news-sitemap.xml`, `app/robots.ts`, `lib/seo/sitemap-eligibility.ts`, `lib/seo/search-console.ts`, `components/structured-data.tsx`, `lib/distribution/indexnow.ts`.
- **Verified:** robots, sitemap index, canonicals and `NewsArticle` JSON-LD are OK. The news sitemap has 0 URLs (nothing in 48 h). Authors are an Organization only.
- **Tasks:** check that retracted URLs return the right notice and stay out of sitemaps (29 RETRACTED); confirm IndexNow fires on publish; pull Search Console coverage through the existing route once access is confirmed.
- **Blocker:** Search Console numbers are **unverified**. The secret `GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON` exists, but no data was read in Sprint 0.
- **Acceptance:** news sitemap non-empty within 48 h of publishing resuming; coverage report captured.

## 07 Content SEO

- **Modules:** `lib/editorial/quality-scoring.ts`, `app/[...slug]`, topic hubs (`content_topics`), `app/about`, `app/editorial-standards`.
- **Tasks:** named, real editors with author pages (owner supplies the people; nothing invented); topic hubs with internal links; a public corrections log.
- **Acceptance:** every article has an accountable person or desk and links to its topic hub.

## 08 UI / UX

- **Modules:** `components/*`, `app/globals.css`, `app/newsroom.css`, `styles/reader.css`, `components/home`, `components/public`.
- **Tasks:** redesign on the existing routes and URLs (no SEO path changes) after Sprint 1. Use `impeccable` / `anti-ai-slop-ui` and visual tests (`npm run test:rendered`).
- **Acceptance:** visual tests updated, phone width checked, no URL changes.

## 09 Performance / accessibility

- **Modules:** `app/layout.tsx`, image route `app/story-image`, `scripts/lighthouse.mjs`.
- **Verified:** home TTFB ~1.5 s, `/latest` ~1.45 s.
- **Tasks:** edge-cache public pages; measure LCP and CLS with `npm run perf` and CrUX; WCAG 2.2 audit.
- **Acceptance:** TTFB below 600 ms on cached pages; no P0 accessibility findings.

## 10 News / distribution

- **Modules:** `lib/distribution/indexnow.ts`, `app/rss.xml`, `app/atom.xml`, `lib/newsletter`, `app/newsletter`.
- **Tasks:** after publishing resumes, a digest built from published stories only (double opt-in already exists); Google News publisher setup is owner-only.
- **Blocked by:** no publishing.

## 11 AdSense

- **Modules:** `components/google-adsense.tsx`, `components/google-ad-slot.tsx`, `lib/advertising`, `app/ads.txt`, `docs/ADVERTISING.md`.
- **Tasks:** keep ads off newsroom, account, error and noindex pages; fix the lint warning about `beforeInteractive`; apply only after steady publishing, named authors and no thin or retracted pages in the index.
- **No promises:** approval is Google's decision.

## 12 Analytics / retention / security

- **Modules:** `lib/analytics/reader-signal.ts`, `components/reader-analytics.tsx`, `lib/auth`, `lib/security`, `docs/SECURITY_TESTING.md`.
- **Tasks:** GA4 / Search Console read access (owner); security review of newsroom auth routes with `sechelix`; retention metric definitions before any growth work.

---

## Sprint 0 results (2026-10-29)

Branch `fix/sprint0-publishing-reliability`. Not deployed.

### 1. AI rate-limit failures and fallback
- **Verified:** 345 of 609 failed runs in 14 days were `AI_PROVIDER_RATE_LIMITED`. Since 2026-10-22 there have been 40-47 `rate_limited` events per day: each 60-minute cooldown expired, the next runs hit the same exhausted quota and failed again. The provider was never recorded.
- **Fix:** `lib/ai/providers.ts` reads the 429 body. A per-day quota (`...PerDay...`, "daily", "per day") becomes `quotaScope: "daily"` and is not retried. The error names its provider. `lib/jobs/executors.ts` sets the cooldown to just after the next midnight Pacific (when Gemini daily quotas reset) instead of one hour, and records the provider and scope.
- **Not fixed (Sprint 1):** a cooldown pauses all providers; the `ai_tasks` ledger is empty.

### 2. Editorial write conflicts
- **Verified:** 52 runs failed with "The editorial write conflicted with current storage state." Version numbering uses `max + 1`, so it is not a version race; the real constraint was hidden by `mapWriteFailure`.
- **Fix:** the message and a `console.warn` now carry the SQLite constraint text (table and column names only, never row values). The cause is diagnosed from the next failure; there is no speculative fix.

### 3. Video backfill FK failures
- **Verified root cause:** `createMediaOnlyRevision` copies the previous version's media and source links into a new draft. When nothing new is found, it tries to delete the draft, but `article_media` and `article_source_links` reference it with `ON DELETE RESTRICT`, so the DELETE fails ("FOREIGN KEY constraint failed"). The failure is logged as `video_failed`, which the cooldown did not cover, so the same articles were retried every 15 minutes. Still happening after the D1 fix deploy: 12 `video_failed` events between 22:12 and 23:01 UTC on 2026-10-28, each leaving a draft.
- **Fix:** `discardDraftVersion` deletes the draft's media, source links and claims, then the draft, in one batch, all guarded by `published_at IS NULL`. Every failure after the draft insert now discards it, and a cleanup failure never hides the original error. The cooldown now also covers `video_failed`.
- **Cleanup (prepared, not run):** `scripts/ops/cleanup-leaked-media-drafts.sql` (precheck with blockers, 500-row batches, Time Travel bookmark first).

### 4. Repeated D1 queries and job cost
- **Verified:** the 69B-row query is gone from code and production. The remaining top readers are listed in 01. All fit inside Workers Paid included reads. The 24-hour total will be re-measured a full day after deploy.
- **Fix in Sprint 0:** the `video_failed` cooldown stops 4 wasted revision attempts per hour per failing article (each one also wrote a full version copy).

### 5. Publishing queue state and recoverable stories
- Read-only listing above (14 review, 7 approved). No retry or publish was done.
- The 7 APPROVED stories are six weeks old and are news; the recommendation is that an editor marks them stale rather than publishing them.

### Before / after evidence
| Check | Before (main) | After (branch) |
|---|---|---|
| New regression tests against old `media-revision.ts` | 5 fail | pass |
| `tsc --noEmit` | pass | pass |
| `npm run lint` | 0 errors, 3 warnings | 0 errors, 3 warnings |
| Vitest | 741 | 752+ pass, 0 fail |
| `npm run build` | pass | pass |
| `npm run test:rendered` | 8/8 | 8/8 |
| Playwright e2e | not run | not run (no UI change in Sprint 0) |
| Production: drafts leaked per hour | ~12 (observed 22:12-23:01 UTC) | expected 0 after deploy (to verify) |

## Blockers and access needed (owner)

1. Approval to deploy the Sprint 0 PR, then to run the draft cleanup.
2. AI provider decision: paid quota or a second provider. Free daily quotas cap output whatever the code does.
3. The values of the AI chain secrets (we only know their names), to confirm routing.
4. Search Console / GA4 read access, or exports. Until then those numbers are unknown.
5. Real names for editors and author pages (07, 11).
6. A decision on the 21 backlog stories.

## Sprint 1 brief: restore publishing safely

Goal: one story a day reaching review without wasted runs, for 7 days in a row.

1. Deploy Sprint 0 (after approval), watch 24 h: zero new orphan drafts, cooldowns set to the daily reset, provider named on every rate limit.
2. Run the draft cleanup (after approval); confirm with the precheck.
3. Fix the `ai_tasks` ledger and make cooldowns per provider so a second provider keeps working while one is exhausted.
4. Read the first write-conflict constraint text and fix that cause with a test.
5. Diagnose why `article.autopublish` selects but publishes nothing (read-only first).
6. Give editors a stale/archive path for the 7 old APPROVED stories.
7. Tighten trend selection (02) so 0-source trends never reach the AI.

Out of scope for Sprint 1: redesign, AdSense, new SEO features.

## Risks and costs

| Risk | Impact | Mitigation |
|---|---|---|
| Cleanup deletes the wrong rows | Data loss | Narrow filter, triggers block published rows, Time Travel bookmark, precheck blockers |
| Daily cooldown idles the newsroom until midnight Pacific | No drafts for hours | Intended when the quota is gone; per-provider cooldown in Sprint 1 |
| Quota pattern differs by provider | Wrong cooldown length | Non-daily 429s keep the old 60-minute cooldown |
| D1 stays above 500 MB | Workers Paid stays required | $5/month base; included reads cover current use |
| Publishing restarts with weak E-E-A-T | Poor Google News / AdSense outcome | Named editors and review trail before any growth push |
