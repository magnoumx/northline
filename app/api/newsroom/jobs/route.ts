import { getD1Binding } from "@/db";
import { authorizeEditorialRequest } from "@/lib/newsroom/editorial-api-security";
import { apiErrorResponse } from "@/lib/security/api";

export const runtime = "edge";

export async function GET(request: Request): Promise<Response> {
  const access = await authorizeEditorialRequest(["audit.view"]);
  if (!access.allowed) return access.response;
  const rawLimit = new URL(request.url).searchParams.get("limit") ?? "100";
  const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 250) {
    return apiErrorResponse("BAD_REQUEST", { status: 400, message: "Limit must be from 1 through 250." });
  }
  try {
    const db = await getD1Binding();
    const [durable, recent, deadLetters] = await Promise.all([
      db.prepare(
        `SELECT id, queue, kind, state, priority, attempt_count AS attemptCount,
          maximum_attempts AS maximumAttempts, available_at AS availableAt,
          locked_until AS lockedUntil, completed_at AS completedAt,
          error_category AS errorCategory, created_at AS createdAt,
          updated_at AS updatedAt
         FROM durable_jobs ORDER BY created_at DESC LIMIT ?1`,
      ).bind(limit).all(),
      db.prepare(
        `SELECT id, job_type AS jobType, state, attempt, error_code AS errorCode,
          error_message AS errorMessage, started_at AS startedAt,
          completed_at AS completedAt, next_retry_at AS nextRetryAt
         FROM job_runs ORDER BY started_at DESC LIMIT ?1`,
      ).bind(limit).all(),
      db.prepare(
        `SELECT id, job_id AS jobId, final_error_category AS finalErrorCategory,
          final_error_digest AS finalErrorDigest, replayed_as_job_id AS replayedAsJobId,
          created_at AS createdAt
         FROM job_dead_letters ORDER BY created_at DESC LIMIT 50`,
      ).all(),
    ]);
    return Response.json(
      { durableJobs: durable.results, recentRuns: recent.results, deadLetters: deadLetters.results },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch {
    return apiErrorResponse("UNAVAILABLE", { status: 503, message: "Job reporting is temporarily unavailable." });
  }
}
