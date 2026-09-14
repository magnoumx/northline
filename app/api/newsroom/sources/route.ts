import { z } from "zod";
import { getD1Binding } from "@/db";
import {
  authorizeEditorialRequest,
  protectEditorialMutation,
} from "@/lib/newsroom/editorial-api-security";
import { readJsonBodyWithLimit } from "@/lib/newsletter/body";
import { apiErrorResponse } from "@/lib/security/api";

export const runtime = "edge";

const sourceInput = z
  .object({
    name: z.string().trim().min(2).max(200),
    domain: z
      .string()
      .trim()
      .min(3)
      .max(253)
      .transform((value) => value.toLowerCase().replace(/^https?:\/\//u, "").replace(/\/$/u, ""))
      .refine((value) => /^[a-z0-9.-]+\.[a-z]{2,}$/u.test(value), "Enter a valid domain."),
    publisher: z.string().trim().min(2).max(200),
    sourceType: z.enum([
      "GOVERNMENT",
      "PRIMARY_DOCUMENT",
      "COMPANY",
      "NEWSROOM",
      "WIRE",
      "RESEARCH",
      "EXPERT",
      "DATASET",
      "OTHER",
    ]),
    country: z.string().trim().length(2).default("US"),
    credibilityTier: z.number().int().min(1).max(5),
    isPrimary: z.boolean().default(false),
    licensingStatus: z.enum([
      "approved",
      "review_required",
      "link_only",
      "restricted",
    ]),
    citationRequirements: z.string().trim().max(1000).optional(),
    reliabilityNotes: z.string().trim().max(2000).optional(),
  })
  .strict();

export async function GET(): Promise<Response> {
  const access = await authorizeEditorialRequest(["source.manage", "audit.view"]);
  if (!access.allowed) return access.response;
  try {
    const db = await getD1Binding();
    const result = await db
      .prepare(
        `SELECT id, name, domain, publisher, source_type AS sourceType,
          country, credibility_tier AS credibilityTier,
          is_primary AS isPrimary, licensing_status AS licensingStatus,
          citation_requirements AS citationRequirements,
          reliability_notes AS reliabilityNotes,
          last_reviewed_at AS lastReviewedAt, updated_at AS updatedAt
         FROM sources ORDER BY credibility_tier ASC, name ASC LIMIT 500`,
      )
      .all();
    return Response.json(
      { sources: result.results },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Source storage is temporarily unavailable.",
    });
  }
}

export async function POST(request: Request): Promise<Response> {
  const access = await authorizeEditorialRequest(["source.manage"]);
  if (!access.allowed) return access.response;
  const protection = await protectEditorialMutation(request, access.user);
  if (!protection.allowed) return protection.response;

  let body: unknown;
  try {
    body = await readJsonBodyWithLimit(request, 32_000);
  } catch {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Send a valid bounded source record.",
    });
  }
  const parsed = sourceInput.safeParse(body);
  if (!parsed.success) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Review the source identity, rights, and reliability fields.",
    });
  }

  const now = Date.now();
  const id = `source_${crypto.randomUUID().replaceAll("-", "")}`;
  try {
    const db = await getD1Binding();
    await db.batch([
      db
        .prepare(
          `INSERT INTO sources (
             id, name, domain, publisher, source_type, country, ownership,
             credibility_tier, is_primary, citation_requirements,
             licensing_status, reliability_notes, last_reviewed_at,
             created_at, updated_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7, ?8, ?9, ?10, ?11, ?12, ?12, ?12)`,
        )
        .bind(
          id,
          parsed.data.name,
          parsed.data.domain,
          parsed.data.publisher,
          parsed.data.sourceType,
          parsed.data.country.toUpperCase(),
          parsed.data.credibilityTier,
          parsed.data.isPrimary ? 1 : 0,
          parsed.data.citationRequirements ?? null,
          parsed.data.licensingStatus,
          parsed.data.reliabilityNotes ?? null,
          now,
        ),
      db
        .prepare(
          `INSERT INTO audit_logs (
             id, actor_id, action, target_type, target_id, decision,
             reason, metadata_json, occurred_at
           ) VALUES (?1, ?2, 'SOURCE_CREATED', 'SOURCE', ?3, 'ALLOWED', ?4, ?5, ?6)`,
        )
        .bind(
          crypto.randomUUID(),
          access.user.userId,
          id,
          "Source added through the protected Newsroom.",
          JSON.stringify({ domain: parsed.data.domain, tier: parsed.data.credibilityTier }),
          now,
        ),
    ]);
    return Response.json({ source: { id, ...parsed.data } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return apiErrorResponse(message.toLowerCase().includes("unique") ? "CONFLICT" : "UNAVAILABLE", {
      status: message.toLowerCase().includes("unique") ? 409 : 503,
      message: message.toLowerCase().includes("unique")
        ? "A source with this domain already exists."
        : "The source could not be saved.",
    });
  }
}
