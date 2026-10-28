# Repo cleanup report: Phase 1 (2026-10-29)

Branch `chore/phase1-cleanup` (based on `fix/d1-backfill-cooldown-scan`, which production already runs). Nothing deployed in this phase.

## Size
| | Before | After |
|---|---|---|
| Tracked files | 666 | 661 |
| Tracked bytes | 8,124,207 | ~8,124,000 (removed files were tiny) |

The repo was already cleaned in `41eaacb`. Most of the size is legitimate: visual-test snapshots (~1.4 MB), `docs/screenshots` (1.2 MB, used by README), `public/og.png`, Drizzle snapshots.

## Changes
**Removed (verified with knip, text search, tsc and the full test run):**
- `styles/newsroom.css`: empty 0-byte file, never imported (the real file is `app/newsroom.css`, imported by `app/globals.css`).
- `lib/living-story/index.ts`, `lib/media/index.ts`, `lib/monitoring/index.ts`, `lib/operations/index.ts`: one-line barrels nobody imports (all callers import the modules directly).
- Dead code: unused `StandardArticlePage` import (`app/[...slug]/page.tsx`), unused `staticLastModified` (`app/sitemaps/pages.xml/route.ts`), unused `centralFinding` (`lib/editorial/autonomous-newsroom.ts`), dead duplicate `positiveNumber` (`lib/jobs/executors.ts`, same as `numberValue`).
- `.gitignore`: added `*.zip`, `*.bak`, `/tmp-sql/`, `/tmp/` (clutter seen in local copies).

**Preserved (knip flagged them, but they are in use or deliberate):**
- `public/reader-preferences.js`: loaded by `app/layout.tsx:110`.
- `scripts/audit-published-articles.mjs`: read-only ops audit tool, no npm script. Keep; add a script later if it stays useful.
- `systemPrefersDark` param in `lib/reader/preferences.ts`: deliberately unused (documented in place).
- `shadcn` devDependency: CLI for `components.json`.

**Requires review (kept):**
- `components/ask-story.tsx` plus its `.ask-story` CSS in `styles/reader.css`: unused component, looks like a disabled feature.
- `lib/intelligence/read-live-overview.ts`: D1 overview reader, not wired to any route.
- 101 unused exports reported by knip (constants/types/helpers). Many are part of module APIs or tests; trim per module during the redesign, not in bulk.
- `positiveNumber` is copied in 5 files (AI budget paths). Consolidate in a focused change with tests.
- Remaining lint warnings (3): AdSense `beforeInteractive` outside `_document`, `<img>` in `components/public/story-pages.tsx`, the intentional param above.
- **Local, outside git** (`C:\Users\hgjk\Desktop\Northline`): the untracked `northline_v10` copy (own `node_modules`, `backups/`, `outputs/`, `.env*`), 12 release/patch zips (four of them ~15 MB each) and 24 one-off `.ps1` repair scripts. These are owner files and may hold secrets or backups. Nothing was deleted; archive them once the owner confirms git is the only source of truth.

## Validation
| Check | Before | After |
|---|---|---|
| `tsc --noEmit` | pass | pass |
| `npm run lint` | 0 errors, 7 warnings | 0 errors, 3 warnings |
| Vitest domain | 741/741 (125 files) | 741/741 |
| `npm run build` | pass | pass |
| `npm run test:rendered` | 8/8 | 8/8 |
| Playwright e2e | not run | not run |

## SEO and content baseline (live site, 2026-10-29)
Working: `robots.txt` (blocks `/newsroom/`, `/api/`, `/search`, account paths), sitemap index with pages, news, images and video sitemaps, canonicals on home and story pages, `NewsArticle` + `BreadcrumbList` + `NewsMediaOrganization` JSON-LD, RSS/Atom, `ads.txt`, `llms.txt`, a real 404, AdSense script present.

Problems (verified):
1. **Publishing stopped on 2026-10-14 23:31 UTC** (see `docs/CLAUDE_HANDOFF.md` for run-failure counts). Because of that, `news-sitemap.xml` has **0 URLs** (Google News only accepts the last 48 h), and freshness and Discover signals are zero.
2. Authors are only `Organization` ("Northline Newsroom"). There are no named, accountable people, which is weak E-E-A-T for Google News and AdSense review of AI-assisted content.
3. Home TTFB ~1.5 s, `/latest` ~1.45 s (server). Measure Core Web Vitals with `npm run perf` and CrUX before the redesign.
4. 29 RETRACTED and 458 REJECTED_EARLY articles. Check that retracted URLs return the right status/notice and stay out of sitemaps.
5. Search Console metrics: **unverified** (no export or access used in this phase). A `api/newsroom/analytics/search-console` route exists.

## Access needed
- Owner approval to push `fix/d1-backfill-cooldown-scan` and this branch and to open PRs (the GitHub push was blocked by the permission policy in this session).
- Search Console / GA4 read access or exports for real metrics.
- AI provider quota/billing decision (rate limits are the biggest blocker to publishing).

## Prioritized roadmap
1. **Restore publishing** (highest value): fix AI rate-limit handling and provider routing, the "editorial write conflicted" CAS failures, and the video-backfill FK error (it also wastes D1 reads every 15 min). Clear the 14 HUMAN_REVIEW and 7 APPROVED backlog through the newsroom.
2. **Merge the D1 fix to `main`** so a redeploy from `main` cannot bring the 69 B-row query back. Add a CI guard against correlated `LIKE` on `audit_logs`.
3. **Editorial trust**: named editors/author pages, a visible review trail, a corrections log. These are prerequisites for Google News and AdSense.
4. **Technical SEO**: retracted-URL handling, internal links to topic hubs, image sizes and LCP, TTFB (cache public pages at the edge).
5. **Redesign** (UI phase) on the existing routes and URLs, keeping SEO paths stable.
6. **Growth**: newsletter double opt-in is already built; add topic follow plus a digest once publishing is steady. Use AI-search visibility via `llms.txt` and citations.
7. **Monetization**: AdSense review only after steady publishing, named authors and no thin or retracted pages in the index. Keep ads off newsroom, account and error pages.

Tooling: the `claude-seo`-style skills (`seo`, `seo-audit`, `seo-technical`, `seo-schema`, `seo-geo`, `seo-sitemap`, …) plus `impeccable`, `accessibility-audit` and `web-perf` are already installed. No extra SEO toolkit is needed.
