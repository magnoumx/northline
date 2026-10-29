# Leaked-draft cleanup, 2026-10-29

Restore bookmark (taken 2026-10-29 08:43:47 UTC, before any delete):
`00006908-00000000-00005113-46d700e420c4235b75a523be1b56ad3e`

Restore: `npx wrangler d1 time-travel restore northline-production --bookmark=<above>` (rolls back ALL writes after that time).

## Result (approved by owner, run 2026-10-29 08:44-~09:xx UTC)
- Precheck: 22,813 candidate drafts; blockers (corrections, story_updates, audio versions, audio ledger, evidence) all 0.
- 46 batches of up to 500 (`scripts/ops/cleanup-leaked-media-drafts.sql` logic, ordered by id), last batch deleted 0.
- Deleted: 22,813 draft versions, 42,853+ article_media links, 78,170+ article_source_links, 0 claims (batch 1's child counts were not captured).
- After: 0 leaked drafts remain; article_versions 44,468 -> 21,655; 250 published versions and 138 live articles untouched; 0 articles with a missing current version.
- D1 size: 945 MB -> 559 MB (still above the 500 MB Free limit).
- Site, health, sitemap and sample story pages: HTTP 200 after cleanup.
