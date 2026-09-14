import { getD1Binding } from "../../db";
import { resolveRuntimeConfig } from "../editorial/runtime-config";
import { buildCockpit, type Cockpit } from "./cockpit";

/** Reads the operating picture from D1. Every value is a count of real rows. */
export async function readCockpit(): Promise<Cockpit> {
  const db = await getD1Binding();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const since = dayStart.getTime();

  const [
    trends,
    runs,
    states,
    audio,
    media,
    cost,
    lastJob,
    failing,
    subscribers,
    issues,
  ] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS total FROM trends WHERE latest_detected_at >= ?1`,
      )
      .bind(since)
      .first<{ total: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS total FROM autonomous_story_runs WHERE created_at >= ?1`,
      )
      .bind(since)
      .first<{ total: number }>(),
    db
      .prepare(`SELECT state, COUNT(*) AS total FROM articles GROUP BY state`)
      .all<{ state: string; total: number }>(),
    db
      .prepare(
        `SELECT
           SUM(CASE WHEN state IN ('QUEUED','GENERATING','PROCESSING','STALE') THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN state IN ('FAILED','REJECTED') THEN 1 ELSE 0 END) AS failed
         FROM article_audio_versions`,
      )
      .first<{ pending: number; failed: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS total FROM articles a
         WHERE a.state IN ('PUBLISHED','UPDATED','CORRECTED','DEVELOPING')
           AND NOT EXISTS (
             SELECT 1 FROM article_media m
             JOIN media_assets s ON s.id = m.media_asset_id
             WHERE m.article_version_id = a.current_version_id
               AND m.role = 'HERO'
               AND s.workflow_state = 'APPROVED'
               AND s.public_url NOT LIKE '/story-image/%'
           )`,
      )
      .first<{ total: number }>(),
    db
      .prepare(
        `SELECT COALESCE(SUM(cost_micros), 0) AS micros
         FROM autonomous_story_runs WHERE created_at >= ?1`,
      )
      .bind(since)
      .first<{ micros: number }>(),
    db
      .prepare(
        `SELECT MAX(completed_at) AS last FROM job_runs WHERE state = 'COMPLETED'`,
      )
      .first<{ last: number | null }>(),
    db
      .prepare(
        `SELECT DISTINCT job_type AS jobType FROM job_runs
         WHERE state = 'FAILED' AND started_at >= ?1`,
      )
      .bind(Date.now() - 60 * 60 * 1000)
      .all<{ jobType: string }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS total FROM newsletter_subscribers WHERE status = 'CONFIRMED'`,
      )
      .first<{ total: number }>()
      .catch(() => ({ total: 0 })),
    db
      .prepare(`SELECT COUNT(*) AS total FROM newsletter_issues WHERE state = 'SENT'`)
      .first<{ total: number }>()
      .catch(() => ({ total: 0 })),
  ]);

  const byState = Object.fromEntries(
    states.results.map((row) => [row.state, Number(row.total)]),
  );
  const lastCompleted = lastJob?.last ? Number(lastJob.last) : null;

  return buildCockpit({
    trendsDiscovered: Number(trends?.total ?? 0),
    storyRunsStarted: Number(runs?.total ?? 0),
    publishedToday: byState.PUBLISHED ?? 0,
    heldForReview: byState.HUMAN_REVIEW_REQUIRED ?? 0,
    approvedWaiting: byState.APPROVED ?? 0,
    audioPending: Number(audio?.pending ?? 0),
    audioFailed: Number(audio?.failed ?? 0),
    articlesWithoutLicensedHero: Number(media?.total ?? 0),
    spentMicros: Number(cost?.micros ?? 0),
    ceilingUsd: resolveRuntimeConfig(
      process.env as Record<string, string | undefined>,
    ).settings.dailyCostCeilingUsd,
    // Null when nothing has ever completed, which reads as unknown rather than
    // as healthy.
    minutesSinceLastJob:
      lastCompleted === null ? null : (Date.now() - lastCompleted) / 60_000,
    failingJobTypes: failing.results.map((row) => row.jobType),
    confirmedSubscribers: Number(subscribers?.total ?? 0),
    newsletterEverSent: Number(issues?.total ?? 0) > 0,
  });
}
