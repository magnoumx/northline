# Claude handoff: US Northline

Short, verified context for the next session. Canonical detail lives in the docs linked below; this file does not repeat them.

## Identity
- Site: https://usnorthline.com (US news, AI-assisted autonomous newsroom with source gates).
- Repo: `magnoumx/northline`. Local git checkout: `C:\Users\hgjk\Desktop\Northline\northline-github`.
- `C:\Users\hgjk\Desktop\Northline\northline_v10` is an **untracked working copy** (git with no commits) with its own `node_modules`, `.env*`, `backups/`, `outputs/` and release zips. Do not treat it as the source of truth; do not delete it without the owner.

## Stack and entry points
- Next.js 16 app router on **vinext** (Vite) → one Cloudflare Worker `northline-newsroom` (`worker/index.ts`: `fetch`, `scheduled`, `queue`).
- D1 `northline-production` (~944 MB, Drizzle schema in `db/`, migrations in `drizzle/`), R2 (`MEDIA`, `MEDIA_QUARANTINE`, `ARTICLE_AUDIO`), Queues (`EDITORIAL_QUEUE`, `MEDIA_QUEUE`, `AD_EVENT_QUEUE` + DLQs), Workers AI, crons `*/15 * * * *`, `0 0 * * *`, `0 0 1 * *`.
- Job flow: cron → `schedulesForCron` → `EDITORIAL_QUEUE` → `queue()` → `lib/jobs/consumer.ts` → `lib/jobs/executors.ts`. Autonomous story pipeline: `lib/editorial/autonomous-newsroom.ts`. Cron is a no-op unless `FEATURE_SCHEDULED_INGESTION` and `FEATURE_DURABLE_JOBS` are `"true"`.
- Public routes: `app/` (`/`, `/story/...` via `app/[...slug]`, `/latest`, `/trending`, `/live`, `/search`, policy pages, feeds `rss.xml` `atom.xml`, `sitemap.xml`, `news-sitemap.xml`, `sitemaps/*`, `llms.txt`). Newsroom UI `app/newsroom/*` (Cloudflare Access + magic-link auth, `lib/auth`). Advertiser portal `app/advertiser/*`, ads APIs `app/api/ads/*`, AdSense `components/google-adsense.tsx`.
- Architecture docs: `docs/ARCHITECTURE.md`, `docs/architecture/*`, `docs/DATABASE.md`, `docs/DEPLOYMENT.md`, `docs/OPERATIONS_RUNBOOK.md`, `docs/SEO.md`, `docs/ADVERTISING.md`, policies `docs/*_POLICY.md`.

## Commands (all verified 2026-10-29 on Windows, Node 22.23, npm 10.8)
- `npm ci` · `npm run typecheck` · `npm run lint` · `npx vitest run --config vitest.config.ts` (741 tests) · `npm run build` · `npm run test:rendered` (needs build).
- `npm run e2e` (Playwright, snapshots are `win32`) was **not run** in Phase 1.
- Deploy: `npm run deploy:production` (vinext deploy). **Owner approval required every time.**
- Windows gotcha: if a build says esbuild "installed for another platform", `node_modules/@esbuild/win32-x64/esbuild.exe` is missing. Delete that folder and run `npm install --no-save @esbuild/win32-x64@<esbuild version>`.
- D1 cost check: `npx wrangler d1 insights northline-production --timePeriod 1d --sort-by reads --json`.

## Safety rules
- No production deploys, remote migrations, D1 writes, publishing, newsletters or ad-setting changes without explicit owner approval.
- Never print or commit `.env*`, `.dev.vars*`, `outputs/*secret*`.
- Every new query on a large table must use an index. Check `rows_read` with a read-only query before shipping. A correlated `LIKE '%x%'` caused the Oct 2026 D1 bill (69 B rows in 31 days).
- Keep: migrations, `wrangler.jsonc` bindings, redirects (`content_redirects`), feeds, audit logs, policies, tests.

## Current state (verified 2026-10-29)
- Production runs version `49a31276` (deployed 2026-10-28 22:12 UTC), built from `5861c52`. That commit is on `main` since PR #1 (`5c30d92`); `main` `7a235d0` adds only the Phase 1 cleanup (PR #2), so `main` and production match in behavior. (Updated 2026-10-29; an earlier version of this line said the fix was not on `main`.)
- Sprint 0 (`fix/sprint0-publishing-reliability`, not deployed): see `docs/NORTHLINE_V2_MASTER_PLAN.md`.
- **No article published since 2026-10-14 23:31 UTC.** Last 14 days of `autonomous_story_runs`: 609 FAILED (345 `AI_PROVIDER_RATE_LIMITED`, ~170 `AUTONOMOUS_TOPIC_NOT_REPORTABLE` with 0 primary sources, 52 "editorial write conflicted", 21 provider unavailable), 88 REVIEW_REQUIRED, 1 COMPLETED. 14 articles wait in HUMAN_REVIEW_REQUIRED; 7 are APPROVED but never published (since 2026-09-14).
- Video backfill fails on every article with `FOREIGN KEY constraint failed` in `createMediaOnlyRevision` (573 times in 2 days before the fix, unchanged after). The cooldown only covers `video_none_found`, so it retries the same 3 newest articles every 15 min.
- Cloudflare plan: Workers Paid is required (DB 944 MB > 500 MB free limit; trends query ~67 M reads/day > 5 M free).

## Next session must know
Read `docs/REPO_CLEANUP_REPORT.md` for the prioritized roadmap. Fix publishing (rate limits, write conflicts, FK bug) before any redesign or SEO push: with nothing new published, Google News eligibility and freshness signals are at zero.
