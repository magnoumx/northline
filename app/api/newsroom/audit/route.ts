import { getD1Binding } from "@/db";
import { authorizeEditorialRequest } from "@/lib/newsroom/editorial-api-security";
import { apiErrorResponse } from "@/lib/security/api";

export const runtime = "edge";

export async function GET(request: Request): Promise<Response> {
  const access = await authorizeEditorialRequest(["audit.view"]);
  if (!access.allowed) return access.response;
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 100);
  if (!Number.isInteger(limit) || limit < 1 || limit > 250) {
    return apiErrorResponse("BAD_REQUEST", { status: 400, message: "Limit must be from 1 through 250." });
  }
  try {
    const db = await getD1Binding();
    const result = await db.prepare(
      `SELECT a.id, a.actor_id AS actorId, u.display_name AS actorName,
        u.email AS actorEmail, a.action, a.target_type AS targetType,
        a.target_id AS targetId, a.decision, a.reason,
        a.metadata_json AS metadataJson, a.occurred_at AS occurredAt
       FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
       ORDER BY a.occurred_at DESC LIMIT ?1`,
    ).bind(limit).all();
    return Response.json({ events: result.results }, { headers: { "cache-control": "private, no-store" } });
  } catch {
    return apiErrorResponse("UNAVAILABLE", { status: 503, message: "Audit reporting is temporarily unavailable." });
  }
}
