import { getD1Binding } from "@/db";
import { authorizeEditorialRequest } from "@/lib/newsroom/editorial-api-security";
import { apiErrorResponse } from "@/lib/security/api";

export const runtime = "edge";

export async function GET(): Promise<Response> {
  const access = await authorizeEditorialRequest(["audit.view"]);
  if (!access.allowed) return access.response;

  try {
    const db = await getD1Binding();
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const [states, today, recent, pendingAudio] = await Promise.all([
      db
        .prepare(
          `SELECT state, COUNT(*) AS total
           FROM autonomous_story_runs
           GROUP BY state ORDER BY state`,
        )
        .all(),
      db
        .prepare(
          `SELECT COUNT(*) AS total,
             COALESCE(SUM(cost_micros),0) AS costMicros,
             COALESCE(SUM(word_count),0) AS words
           FROM autonomous_story_runs
           WHERE created_at >= ?1`,
        )
        .bind(dayStart.getTime())
        .first(),
      db
        .prepare(
          `SELECT r.id, r.trend_id AS trendId, r.state, r.attempt_count AS attemptCount,
             r.article_id AS articleId, r.article_version_id AS articleVersionId,
             r.quality_score AS qualityScore, r.word_count AS wordCount,
             r.cost_micros AS costMicros, r.error_code AS errorCode,
             r.error_message AS errorMessage, r.created_at AS createdAt,
             r.updated_at AS updatedAt, t.original_term AS headline
           FROM autonomous_story_runs r
           LEFT JOIN trends t ON t.id=r.trend_id
           ORDER BY r.updated_at DESC LIMIT 100`,
        )
        .all(),
      db
        .prepare(
          `SELECT COUNT(*) AS total FROM articles a
           WHERE a.state IN ('PUBLISHED','UPDATED','CORRECTED','DEVELOPING')
             AND a.current_version_id IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM article_audio_versions av
               WHERE av.article_version_id=a.current_version_id
                 AND av.variant='FULL_ARTICLE'
                 AND av.state='READY'
             )`,
        )
        .first(),
    ]);

    return Response.json(
      {
        enabled:
          process.env.FEATURE_AUTONOMOUS_NEWSROOM === "true" &&
          process.env.AUTONOMOUS_SYSTEM_APPROVAL === "true",
        publishing:
          process.env.FEATURE_AUTO_PUBLISH === "true" &&
          process.env.AUTO_PUBLISH_READINESS_APPROVED === "true",
        audio: process.env.FEATURE_ARTICLE_AUDIO === "true",
        states: states.results,
        today,
        pendingAudio: Number(
          (pendingAudio as { total?: number } | null)?.total ?? 0,
        ),
        recent: recent.results,
        generatedAt: new Date().toISOString(),
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Autonomous newsroom reporting is temporarily unavailable.",
    });
  }
}
