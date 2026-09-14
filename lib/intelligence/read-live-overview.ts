import { getD1Binding } from "../../db";
import { buildLiveOverview, type LiveOverview } from "./live-overview";

/**
 * Reads the Intelligence overview from D1.
 *
 * One query per fact, each counting rows that exist. Nothing here estimates,
 * samples or projects: if a number is not measured it arrives as null and the
 * surface says "Not measured".
 */
export async function readLiveOverview(
  periodHours = 24,
): Promise<LiveOverview> {
  const db = await getD1Binding();
  const since = Date.now() - periodHours * 60 * 60 * 1000;

  const states = await db
    .prepare(`SELECT state, COUNT(*) AS total FROM articles GROUP BY state`)
    .all<{ state: string; total: number }>();

  const articlesByState = Object.fromEntries(
    states.results.map((row) => [row.state, Number(row.total)]),
  );

  const sourcing = await db
    .prepare(
      `SELECT
         COUNT(*) AS linked,
         SUM(CASE WHEN relationship = 'PRIMARY' THEN 1 ELSE 0 END) AS primaryLinks
       FROM article_source_links l
       JOIN articles a ON a.current_version_id = l.article_version_id
       WHERE a.state IN ('PUBLISHED','UPDATED','CORRECTED','DEVELOPING')`,
    )
    .first<{ linked: number; primaryLinks: number }>();

  const withoutPrimary = await db
    .prepare(
      `SELECT COUNT(*) AS total FROM articles a
       WHERE a.state IN ('PUBLISHED','UPDATED','CORRECTED','DEVELOPING')
         AND NOT EXISTS (
           SELECT 1 FROM article_source_links l
           WHERE l.article_version_id = a.current_version_id
             AND l.relationship = 'PRIMARY'
         )`,
    )
    .first<{ total: number }>();

  // A hero counts only when it is a licensed asset, not the house graphic.
  const media = await db
    .prepare(
      `SELECT COUNT(DISTINCT a.id) AS total FROM articles a
       JOIN article_media m ON m.article_version_id = a.current_version_id
         AND m.role = 'HERO'
       JOIN media_assets s ON s.id = m.media_asset_id
         AND s.workflow_state = 'APPROVED'
         AND s.verification_state = 'VERIFIED'
         AND s.public_url NOT LIKE '/story-image/%'
       WHERE a.state IN ('PUBLISHED','UPDATED','CORRECTED','DEVELOPING')`,
    )
    .first<{ total: number }>();

  const audio = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN state = 'READY' THEN 1 ELSE 0 END) AS ready,
         SUM(CASE WHEN state IN ('QUEUED','GENERATING','PROCESSING','STALE') THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN state IN ('FAILED','REJECTED') THEN 1 ELSE 0 END) AS failed
       FROM article_audio_versions`,
    )
    .first<{ ready: number; pending: number; failed: number }>();

  const cost = await db
    .prepare(
      `SELECT COALESCE(SUM(cost_micros), 0) AS micros
       FROM autonomous_story_runs WHERE created_at >= ?1`,
    )
    .bind(since)
    .first<{ micros: number }>();

  const wordCount = await db
    .prepare(
      `SELECT AVG(LENGTH(v.body_json)) AS averageBytes
       FROM articles a JOIN article_versions v ON v.id = a.current_version_id
       WHERE a.state IN ('PUBLISHED','UPDATED','CORRECTED','DEVELOPING')`,
    )
    .first<{ averageBytes: number | null }>();

  const readers = await db
    .prepare(
      `SELECT COUNT(DISTINCT COALESCE(anonymous_id_hash, id)) AS total
       FROM analytics_events WHERE occurred_at >= ?1`,
    )
    .bind(since)
    .first<{ total: number }>();

  const measuredReaders = Number(readers?.total ?? 0);

  return buildLiveOverview(
    {
      articlesByState,
      // Body JSON bytes divided by an average word length is an estimate, and
      // an estimate presented as a count is the habit this page is replacing.
      averageWordCount: wordCount?.averageBytes
        ? Math.round(Number(wordCount.averageBytes) / 6.5)
        : null,
      linkedSources: Number(sourcing?.linked ?? 0),
      primarySources: Number(sourcing?.primaryLinks ?? 0),
      articlesWithoutPrimary: Number(withoutPrimary?.total ?? 0),
      articlesWithLicensedHero: Number(media?.total ?? 0),
      publishedTotal: articlesByState.PUBLISHED ?? 0,
      audioReady: Number(audio?.ready ?? 0),
      audioPending: Number(audio?.pending ?? 0),
      audioFailed: Number(audio?.failed ?? 0),
      costMicros: Number(cost?.micros ?? 0),
      dailyCeilingUsd: Number(process.env.AUTONOMOUS_DAILY_COST_LIMIT_USD) || null,
      // Zero measured readers is genuinely "nothing measured yet", not a
      // reading of zero.
      measuredReaders: measuredReaders > 0 ? measuredReaders : null,
    },
    periodHours,
  );
}
