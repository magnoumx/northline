import { z } from "zod";
import { getD1Binding } from "@/db";
import {
  authorizeEditorialRequest,
  protectEditorialMutation,
} from "@/lib/newsroom/editorial-api-security";
import { readJsonBodyWithLimit } from "@/lib/newsletter/body";
import { apiErrorResponse } from "@/lib/security/api";

export const runtime = "edge";

const draftInput = z
  .object({
    subject: z.string().trim().min(4).max(180),
    previewText: z.string().trim().min(4).max(240),
    bodyText: z.string().trim().min(20).max(50_000),
    sensitive: z.boolean().default(false),
  })
  .strict();

const actionInput = z
  .object({
    id: z.string().trim().min(8).max(100),
    action: z.enum(["approve", "return_to_draft"]),
  })
  .strict();

export async function GET(): Promise<Response> {
  const access = await authorizeEditorialRequest(["newsletter.manage", "audit.view"]);
  if (!access.allowed) return access.response;
  try {
    const db = await getD1Binding();
    const result = await db
      .prepare(
        `SELECT id, slug, subject, preview_text AS previewText,
          body_text AS bodyText, state, scheduled_at AS scheduledAt,
          approved_by_id AS approvedById, sent_at AS sentAt,
          sensitive, created_at AS createdAt, updated_at AS updatedAt
         FROM newsletter_issues ORDER BY created_at DESC LIMIT 100`,
      )
      .all();
    return Response.json(
      { issues: result.results },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Newsletter issue storage is temporarily unavailable.",
    });
  }
}

export async function POST(request: Request): Promise<Response> {
  const access = await authorizeEditorialRequest(["newsletter.manage"]);
  if (!access.allowed) return access.response;
  const protection = await protectEditorialMutation(request, access.user);
  if (!protection.allowed) return protection.response;

  let body: unknown;
  try {
    body = await readJsonBodyWithLimit(request, 64_000);
  } catch {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Send a valid bounded newsletter draft.",
    });
  }
  const parsed = draftInput.safeParse(body);
  if (!parsed.success) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Review the subject, preview text, and issue body.",
    });
  }

  const now = Date.now();
  const id = `newsletter_${crypto.randomUUID().replaceAll("-", "")}`;
  const slug = `${new Date(now).toISOString().slice(0, 10)}-${slugify(parsed.data.subject)}-${id.slice(-6)}`;
  const bodyHtml = bodyTextToSafeHtml(parsed.data.bodyText);
  try {
    const db = await getD1Binding();
    await db.batch([
      db
        .prepare(
          `INSERT INTO newsletter_issues (
             id, slug, subject, preview_text, body_html_sanitized, body_text,
             state, scheduled_at, approved_by_id, sent_at, sensitive,
             created_at, updated_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'DRAFT', NULL, NULL, NULL, ?7, ?8, ?8)`,
        )
        .bind(
          id,
          slug,
          parsed.data.subject,
          parsed.data.previewText,
          bodyHtml,
          parsed.data.bodyText,
          parsed.data.sensitive ? 1 : 0,
          now,
        ),
      db
        .prepare(
          `INSERT INTO audit_logs (
             id, actor_id, action, target_type, target_id, decision,
             reason, metadata_json, occurred_at
           ) VALUES (?1, ?2, 'NEWSLETTER_DRAFT_CREATED', 'NEWSLETTER', ?3,
             'ALLOWED', 'Newsletter issue saved as a non-sendable draft.', ?4, ?5)`,
        )
        .bind(
          crypto.randomUUID(),
          access.user.userId,
          id,
          JSON.stringify({ subject: parsed.data.subject, sensitive: parsed.data.sensitive }),
          now,
        ),
    ]);
    return Response.json(
      { issue: { id, slug, ...parsed.data, state: "DRAFT", createdAt: now } },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    return apiErrorResponse(message.includes("unique") ? "CONFLICT" : "UNAVAILABLE", {
      status: message.includes("unique") ? 409 : 503,
      message: message.includes("unique")
        ? "A newsletter issue with this identity already exists."
        : "The newsletter draft could not be saved.",
    });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const access = await authorizeEditorialRequest(["newsletter.manage"]);
  if (!access.allowed) return access.response;
  const protection = await protectEditorialMutation(request, access.user);
  if (!protection.allowed) return protection.response;

  let body: unknown;
  try {
    body = await readJsonBodyWithLimit(request, 8_000);
  } catch {
    return apiErrorResponse("BAD_REQUEST", { status: 400, message: "Send a valid newsletter action." });
  }
  const parsed = actionInput.safeParse(body);
  if (!parsed.success) {
    return apiErrorResponse("BAD_REQUEST", { status: 400, message: "Choose a valid newsletter action." });
  }
  const now = Date.now();
  const nextState = parsed.data.action === "approve" ? "APPROVED" : "DRAFT";
  try {
    const db = await getD1Binding();
    const current = await db
      .prepare("SELECT state, sent_at AS sentAt FROM newsletter_issues WHERE id=?1 LIMIT 1")
      .bind(parsed.data.id)
      .first<{ state: string; sentAt: number | null }>();
    if (!current) {
      return apiErrorResponse("NOT_FOUND", { status: 404, message: "Newsletter issue not found." });
    }
    if (current.sentAt || current.state === "SENT") {
      return apiErrorResponse("CONFLICT", {
        status: 409,
        message: "Sent newsletter issues are immutable.",
      });
    }
    await db.batch([
      db
        .prepare(
          `UPDATE newsletter_issues SET state=?1, approved_by_id=?2,
             scheduled_at=NULL, updated_at=?3 WHERE id=?4`,
        )
        .bind(
          nextState,
          nextState === "APPROVED" ? access.user.userId : null,
          now,
          parsed.data.id,
        ),
      db
        .prepare(
          `INSERT INTO audit_logs (
             id, actor_id, action, target_type, target_id, decision,
             reason, metadata_json, occurred_at
           ) VALUES (?1, ?2, ?3, 'NEWSLETTER', ?4, 'ALLOWED', ?5, ?6, ?7)`,
        )
        .bind(
          crypto.randomUUID(),
          access.user.userId,
          nextState === "APPROVED" ? "NEWSLETTER_APPROVED" : "NEWSLETTER_RETURNED_TO_DRAFT",
          parsed.data.id,
          nextState === "APPROVED"
            ? "Issue approved for a later explicit delivery operation."
            : "Issue returned to draft without sending.",
          JSON.stringify({ previousState: current.state, nextState }),
          now,
        ),
    ]);
    return Response.json({ issue: { id: parsed.data.id, state: nextState, updatedAt: now } });
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "The newsletter workflow could not be updated.",
    });
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80) || "issue";
}

function bodyTextToSafeHtml(value: string): string {
  return value
    .split(/\n{2,}/u)
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}
