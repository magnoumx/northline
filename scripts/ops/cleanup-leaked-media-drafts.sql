-- Remove draft versions leaked by the media-only revision path.
--
-- NOT RUN. Needs explicit owner approval, and only after the fix in
-- lib/editorial/media-revision.ts (discardDraftVersion) is deployed, otherwise
-- new drafts keep leaking while this runs.
--
-- What it removes: article_versions rows that
--   * were never published (published_at IS NULL; triggers block anything else),
--   * were created by the video backfill (created_by_id + change_summary),
--   * are not any article's current version,
-- plus their article_media / article_source_links / claims rows, which only
-- exist because they were copied forward into the draft. Intelligence tables
-- that reference article_versions use ON DELETE CASCADE and clean themselves.
-- 2026-10-29 count: 22,810 drafts on 61 articles (worst article: 4,270).
--
-- Steps (run from the repo root, one at a time):
--   1. Record a restore point:
--        npx wrangler d1 time-travel info northline-production
--      Save the bookmark. Restore, if ever needed:
--        npx wrangler d1 time-travel restore northline-production --bookmark=<id>
--   2. Precheck (section A). Every count in "blockers" must be 0.
--   3. Run section B repeatedly until it reports 0 changes. Each pass handles
--      500 drafts so no single statement runs long or blocks the cron jobs.
--   4. Run section A again: candidate_drafts must be 0.
-- The script is idempotent: a re-run only finds what is still left.

-- ===== A. Precheck (read-only) =====
WITH d AS (
  SELECT v.id FROM article_versions v
  WHERE v.published_at IS NULL
    AND v.created_by_id = 'system:autonomous'
    AND v.change_summary LIKE 'Embedded source video%'
    AND NOT EXISTS (SELECT 1 FROM articles a WHERE a.current_version_id = v.id)
)
SELECT
  (SELECT COUNT(*) FROM d) AS candidate_drafts,
  -- blockers: rows this script does not delete; if any exist, stop and review.
  (SELECT COUNT(*) FROM corrections c WHERE c.from_version_id IN (SELECT id FROM d) OR c.corrected_version_id IN (SELECT id FROM d)) AS blocker_corrections,
  (SELECT COUNT(*) FROM story_updates u WHERE u.article_version_id IN (SELECT id FROM d)) AS blocker_story_updates,
  (SELECT COUNT(*) FROM article_audio_versions x WHERE x.article_version_id IN (SELECT id FROM d)) AS blocker_audio_versions,
  (SELECT COUNT(*) FROM article_audio_cost_ledger x WHERE x.article_version_id IN (SELECT id FROM d)) AS blocker_audio_ledger,
  (SELECT COUNT(*) FROM evidence e INNER JOIN claims c ON c.id = e.claim_id WHERE c.article_version_id IN (SELECT id FROM d)) AS blocker_evidence;

-- ===== B. One batch of 500 (repeat until 0 changes) =====
CREATE TEMP TABLE IF NOT EXISTS leaked_drafts_batch (id TEXT PRIMARY KEY);
DELETE FROM leaked_drafts_batch;
INSERT INTO leaked_drafts_batch (id)
  SELECT v.id FROM article_versions v
  WHERE v.published_at IS NULL
    AND v.created_by_id = 'system:autonomous'
    AND v.change_summary LIKE 'Embedded source video%'
    AND NOT EXISTS (SELECT 1 FROM articles a WHERE a.current_version_id = v.id)
  LIMIT 500;
DELETE FROM article_media WHERE article_version_id IN (SELECT id FROM leaked_drafts_batch);
DELETE FROM article_source_links WHERE article_version_id IN (SELECT id FROM leaked_drafts_batch);
DELETE FROM claims WHERE article_version_id IN (SELECT id FROM leaked_drafts_batch);
DELETE FROM article_versions
  WHERE id IN (SELECT id FROM leaked_drafts_batch) AND published_at IS NULL;
SELECT changes() AS versions_deleted_this_batch;
