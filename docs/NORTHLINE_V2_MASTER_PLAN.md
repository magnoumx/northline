# Northline V2: master plan

Canonical plan for the V2 program. One document, updated at the end of every sprint. Facts marked **verified** were checked in code or against production (read-only) on the date given; everything else is a plan or an assumption and says so.

Last updated: 2026-10-29 (Sprint 1, Tracks A-C).

## Progress tracker

| # | Workstream | Priority | Status | Next sprint |
|---|---|---|---|---|
| 01 | Infrastructure / Cloudflare | P0 | Sprint 0 + cleanup done, `e7a611ac` live (945 MB -> 559 MB) | 1 |
| 02 | Trend intelligence | P1 | PR #6: measured primary-source provenance + zero-source tracking | 2 |
| 03 | Research / fact check | P1 | Not started | 2 |
| 04 | AI publishing engine | P0 | PR #5: write-conflict cause fixed, run spacing, stale recovery, provider logging | 1 |
| 05 | Newsroom / CMS | P0 | Autopublish diagnosed (policy, not bug); backlog needs editor | 1 |
| 06 | Technical SEO / indexing | P1 | Live audit done; PR #7: http->https, 410 for retractions | 2 |
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
| Production: drafts leaked per run | ~3 (observed 22:12-23:01 UTC) | 0 in the 23:30 UTC run after deploy (same articles now end as `video_none_found`) |

## Sprint 0 deploy and overnight findings (2026-10-28 23:20 UTC onward)

- PR #3 merged (`d69c1e4`) and deployed as `1c7122bf` from `northline_v10`. That directory holds the real `wrangler.jsonc` (D1 ids, queue `max_concurrency: 2`); the GitHub copy has placeholder ids, so a deploy straight from `northline-github` would fail or point at the wrong DB. The 8 changed source files were copied from `main`; v10's previous copies are backed up in the session scratchpad.
- **Autopublish is not broken.** It runs every 15 minutes and finds 0 candidates (288 runs in 3 days) because it only takes `risk_level = 'LOW'`, while stories that fail the auto-approve gate are marked MEDIUM and sent to a human. All 7 APPROVED stories are MEDIUM, so a person has to publish them. This is policy; it was not loosened.
- **The review backlog expires itself.** `retireStaleReviewBacklog` retires review stories older than 72 hours. The 14 waiting stories (Oct 26-28) will start dropping out from Oct 29-31 unless an editor acts.
- **Why stories need review (7 days, 88 runs):** missing primary source (21), central claim without primary evidence (21), too short (16), review not independent (14), fact review unavailable (10), fact review blocking (6). "Not independent" and "unavailable" mean the second provider for the fact check was not available, which is the same quota problem.
- **`ai_tasks` is not a broken ledger.** Only the newsroom review-package route and one job use it. The autonomous newsroom records cost in `autonomous_story_runs.cost_micros`: $3.3 for 35 review-stage stories in 7 days (about $0.08 each). Failed runs record $0 even though they spent a discovery call, so real spend is a little higher.
- **0-source trends:** 177 runs in 14 days ended `TOPIC_NOT_REPORTABLE`. Each spent one web-grounded discovery call (daily quota) first. The trend's own fields cannot predict it: source velocity is the same for good and bad trends (3.3 vs 3.2), and `primary_source_availability` is 0 on every trend (never filled in). No pre-AI gate was added, because it would cut good stories just as often as bad ones. Fix the data first (Sprint 2, workstream 02).
- **Per-provider cooldown:** deprioritised. The gateway already falls through to the next provider on a rate limit, so a run fails as rate-limited only when every provider in its chain is exhausted. The global cooldown is therefore right unless a chain has one provider, which depends on the secret chain values.
- Added `tests/jobs/d1-query-guard.test.ts`: fails CI if any runtime file builds a `LIKE '%' || column` pattern (verified to catch a planted example).

## Sprint 1 results: Tracks A-C (2026-10-29)

State reconciled: `main` = `9f57b57`, production = `e7a611ac` (built from it), no open PRs at start. Leaked drafts: 0. Queue jobs: all COMPLETED after the deploy catch-up.

**Track A, publishing reliability ([PR #5](https://github.com/magnoumx/northline/pull/5))**
- Write conflicts solved: the Sprint 0 diagnostic showed all 3 recent ones were `UNIQUE constraint failed: article_source_links(article_version_id, source_id)`, from two leads by the same outlet. The write service now de-duplicates sources per version.
- Two story runs started together (queue concurrency 2) and both hit google per-minute 429s. Generate messages are now spaced (`AUTONOMOUS_GENERATE_SPACING_SECONDS`, default 180 s).
- A dead run stayed RUNNING behind the cooldown. Stale recovery now runs first.
- Drafting and review providers are now logged per finished run (`article.generate` / `providers`), so fact-review independence becomes measurable.
- Verified working with no change: provider and quota scope recorded on 429s (`google`, `short`); live-search cost recorded on not-reportable runs ($0.0114).
- AI chains: every chain is set by a production secret (names verified, values not read), so the code defaults are not evidence. The new provider log will show the real routing after deploy.
- Real cost: about $0.08 per story that reaches review; spend is negligible. Output is limited by provider quota and source availability, not by cost.

**Track B, trend intelligence ([PR #6](https://github.com/magnoumx/northline/pull/6))**
- `primary_source_availability` was a literal 0 at ingestion and never updated. Live discovery now writes the measured primary-source count back for both outcomes, with a `trend.discovery` diagnostic as provenance. It is deliberately not a gate yet.
- `source_velocity` counts re-observations of the same signal, not outlets. Next: a distinct-outlet count from `trend_signal_observations`, benchmarked against the 265 measured runs before it touches selection.
- Not started: entity clustering, the dashboard and caching (see the next sprint).

**Track C, technical SEO ([PR #7](https://github.com/magnoumx/northline/pull/7))**
- Fixed: http served the full site with 200 (now 301 to https); 29 retracted stories returned a generic 404 (now 410 with a notice and a corrections link).
- Verified OK: robots, sitemap index, all 138 live stories in `pages.xml`, canonicals, NewsArticle JSON-LD with honest matching dates, `max-image-preview:large`, trailing-slash 308.
- Remaining: news sitemap empty (no publishing); `www` has no DNS record (owner); edge caching is not effective for Worker HTML (proposal; the CSP nonce makes it a design decision); author is an Organization only (Track D).
- Search Console: not queried. The integration needs the production credential secret plus an authenticated newsroom session (Cloudflare Access). Options: the owner opens the newsroom analytics page, or grants the service account and runs the existing route. No numbers are reported until then.

**Next sprint**
1. Deploy PRs #5-#7 after approval, then smoke-check: http 301, retracted 410, provider log rows, no concurrent 429 pairs.
2. Track B: distinct-outlet source velocity; entity clustering and duplicate suppression; discovery outcomes on `/newsroom/trends`.
3. Track D: content audit of the 138 live stories (dates, attribution, duplicates, image rights) and real masthead names (owner).
4. Track E: design tokens and an article-layout spike behind visual tests, no URL changes.

## Blockers and access needed (owner)

1. Approval to deploy the Sprint 0 PR, then to run the draft cleanup.
2. AI provider decision: paid quota or a second provider. Free daily quotas cap output whatever the code does.
3. The values of the AI chain secrets (we only know their names), to confirm routing.
4. Search Console / GA4 read access, or exports. Until then those numbers are unknown.
5. Real names for editors and author pages (07, 11).
6. A decision on the 21 backlog stories.

### Options for each blocker (pick one)

| Blocker | Option A (recommended) | Option B | Option C |
|---|---|---|---|
| Draft cleanup | Run `scripts/ops/cleanup-leaked-media-drafts.sql` after 24 h of no new leaks | Run it now (the leak is fixed in code) | Leave the rows; cost is storage only |
| AI quota | Enable paid tier on the current Gemini key (recorded cost about $0.08 per review-stage story; today's ~150 stories/month would be about $12-15/month, plus discovery calls that are not recorded) | Add Anthropic Haiku as the second provider in every chain, so fact review is independent | Stay on free quota and accept 3-8 drafts a day |
| AI chain values | Owner reads them in the Cloudflare dashboard (names only were listed) and confirms each chain has 2+ providers | Replace them with a documented default from `docs/AI_POLICY.md` | — |
| 14 review stories | Editor reviews them in `/newsroom/review` before the 72 h retirement | Let them retire and rely on new drafts | Extend `maxAgeHours` (config change, needs approval) |
| 7 old APPROVED stories | Mark stale/archive (six weeks old) | Publish the still-evergreen ones (WEATHER and SPORTS likely not) | — |
| Search Console / GA4 | Owner grants read access to the existing service account | Owner exports the last 3 months as CSV | — |
| Named editors | Owner names real people and roles; we build author pages | Keep the desk byline and publish a masthead page with real names | — |

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
