import { z } from "zod";
import { readJsonBodyWithLimit } from "@/lib/newsletter/body";
import {
  authorizeEditorialRequest,
  protectEditorialMutation,
} from "@/lib/newsroom/editorial-api-security";
import { apiErrorResponse } from "@/lib/security/api";
import type { Permission } from "@/lib/auth/permissions";

export const runtime = "edge";

const MAXIMUM_BODY_BYTES = 2_048;
const requestSchema = z
  .object({
    kind: z.enum([
      "article.autodraft",
      "article.autopublish",
      "article_audio.backfill",
      "internal_links.refresh",
    ]),
  })
  .strict();

const requiredFlags: Record<z.infer<typeof requestSchema>["kind"], string[]> = {
  "article.autodraft": [
    "FEATURE_DURABLE_JOBS",
    "FEATURE_AUTONOMOUS_NEWSROOM",
  ],
  "article.autopublish": ["FEATURE_DURABLE_JOBS", "FEATURE_AUTO_PUBLISH"],
  "article_audio.backfill": [
    "FEATURE_DURABLE_JOBS",
    "FEATURE_ARTICLE_AUDIO",
  ],
  "internal_links.refresh": [
    "FEATURE_DURABLE_JOBS",
    "FEATURE_INTERNAL_LINKS",
  ],
};

/**
 * Each operation maps to its own capability. Authorising the route with a broad
 * "settings.manage or audit.view" check let any role that can read the audit
 * log start cost-bearing and publication-adjacent work.
 */
const permissionForKind: Record<string, Permission> = {
  "article.autodraft": "automation.autodraft.run",
  "article.autopublish": "automation.autopublish.run",
  "article_audio.backfill": "automation.audio.run",
  "internal_links.refresh": "automation.internal_links.run",
};

export async function POST(request: Request): Promise<Response> {
  // The body is parsed before authorisation so the exact capability for the
  // requested operation can be demanded, rather than a permissive union.
  const preflight = await authorizeEditorialRequest(["workspace.access"]);
  if (!preflight.allowed) return preflight.response;

  const protection = await protectEditorialMutation(request, preflight.user);
  if (!protection.allowed) return protection.response;

  let body: unknown;
  try {
    body = await readJsonBodyWithLimit(request, MAXIMUM_BODY_BYTES);
  } catch {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Send a valid bounded JSON automation request.",
    });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Select a supported autonomous newsroom operation.",
    });
  }

  const requiredPermission = permissionForKind[parsed.data.kind];
  if (!requiredPermission) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Select a supported autonomous newsroom operation.",
    });
  }

  const access = await authorizeEditorialRequest([requiredPermission]);
  if (!access.allowed) return access.response;

  const missing = requiredFlags[parsed.data.kind].filter(
    (flag) => process.env[flag] !== "true",
  );
  if (missing.length > 0) {
    return apiErrorResponse("CONFLICT", {
      status: 409,
      message: `The operation is disabled by: ${missing.join(", ")}.`,
    });
  }

  try {
    const { env } = await import("cloudflare:workers");
    if (!env.EDITORIAL_QUEUE) {
      return apiErrorResponse("UNAVAILABLE", {
        status: 503,
        message: "The editorial queue binding is unavailable.",
      });
    }

    const scheduledTime = new Date().toISOString();
    await env.EDITORIAL_QUEUE.send({
      kind: parsed.data.kind,
      scheduledTime,
      source: "manual-autonomous-control",
    });

    return Response.json(
      {
        accepted: true,
        kind: parsed.data.kind,
        scheduledTime,
        message: `${parsed.data.kind} was queued successfully.`,
      },
      {
        status: 202,
        headers: { "cache-control": "private, no-store" },
      },
    );
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "The autonomous operation could not be queued.",
    });
  }
}
