import { z } from "zod";
import { getD1Binding } from "@/db";
import {
  authorizeEditorialRequest,
  protectEditorialMutation,
} from "@/lib/newsroom/editorial-api-security";
import { readJsonBodyWithLimit } from "@/lib/newsletter/body";
import { apiErrorResponse } from "@/lib/security/api";

export const runtime = "edge";
const SAFE_ID = /^[A-Za-z0-9:_-]{8,128}$/u;
const inputSchema = z.object({
  verificationStatus: z.enum(["VERIFIED", "PARTIALLY_VERIFIED", "DISPUTED", "UNVERIFIED"]),
  reviewNotes: z.string().trim().min(20).max(2_000),
}).strict();

type Context = { params: Promise<{ articleId: string; claimId: string }> };

export async function PATCH(request: Request, context: Context): Promise<Response> {
  const access = await authorizeEditorialRequest(["article.approve"]);
  if (!access.allowed) return access.response;
  const protection = await protectEditorialMutation(request, access.user);
  if (!protection.allowed) return protection.response;
  const { articleId, claimId } = await context.params;
  if (!SAFE_ID.test(articleId) || !SAFE_ID.test(claimId)) {
    return apiErrorResponse("NOT_FOUND", { status: 404, message: "Claim not found." });
  }
  let body: unknown;
  try {
    body = await readJsonBodyWithLimit(request, 16_000);
  } catch {
    return apiErrorResponse("BAD_REQUEST", { status: 400, message: "Send a bounded claim review." });
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return apiErrorResponse("BAD_REQUEST", { status: 400, message: "Review the verification status and notes." });
  }
  const now = Date.now();
  try {
    const db = await getD1Binding();
    const claim = await db
      .prepare(
        `SELECT c.id, c.primary_evidence_available AS primaryEvidenceAvailable,
          a.current_version_id AS currentVersionId, a.state
         FROM claims c
         JOIN article_versions v ON v.id = c.article_version_id
         JOIN articles a ON a.id = v.article_id
         WHERE c.id = ?1 AND a.id = ?2 AND c.article_version_id = a.current_version_id
         LIMIT 1`,
      )
      .bind(claimId, articleId)
      .first<{ id: string; primaryEvidenceAvailable: number; currentVersionId: string; state: string }>();
    if (!claim) {
      return apiErrorResponse("NOT_FOUND", { status: 404, message: "Claim not found in the current article version." });
    }
    if (["PUBLISHED", "DEVELOPING", "UPDATED", "CORRECTED", "RETRACTED", "ARCHIVED"].includes(claim.state)) {
      return apiErrorResponse("CONFLICT", { status: 409, message: "Published claims require a new correction or update version." });
    }
    if (parsed.data.verificationStatus === "VERIFIED" && claim.primaryEvidenceAvailable !== 1) {
      return apiErrorResponse("CONFLICT", { status: 409, message: "A central claim cannot be verified without primary evidence." });
    }
    const result = await db.batch([
      db
        .prepare(
          `UPDATE claims SET verification_status=?1, reviewer_id=?2,
             review_notes=?3, verified_at=?4
           WHERE id=?5 AND article_version_id=?6`,
        )
        .bind(
          parsed.data.verificationStatus,
          access.user.userId,
          parsed.data.reviewNotes,
          parsed.data.verificationStatus === "VERIFIED" ? now : null,
          claimId,
          claim.currentVersionId,
        ),
      db
        .prepare(
          `INSERT INTO audit_logs (
             id, actor_id, action, target_type, target_id, decision,
             reason, metadata_json, occurred_at
           ) VALUES (?1, ?2, 'CLAIM_REVIEWED', 'CLAIM', ?3, 'ALLOWED', ?4, ?5, ?6)`,
        )
        .bind(
          crypto.randomUUID(),
          access.user.userId,
          claimId,
          parsed.data.reviewNotes,
          JSON.stringify({ articleId, verificationStatus: parsed.data.verificationStatus }),
          now,
        ),
    ]);
    if (!result[0].success) {
      throw new Error("Claim update failed.");
    }
    return Response.json({ claim: { id: claimId, verificationStatus: parsed.data.verificationStatus } });
  } catch {
    return apiErrorResponse("UNAVAILABLE", { status: 503, message: "The claim review could not be saved." });
  }
}
