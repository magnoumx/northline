import { z } from "zod";
import { getDb } from "@/db";
import { analyticsEvents } from "@/db/schema-v2";
import { readAdvertisingJson } from "@/lib/advertising/body";
import { apiErrorResponse } from "@/lib/security/api";
import { hmacSha256Base64Url } from "@/lib/security/crypto";
import { validateMutationRequest } from "@/lib/security/origin";
import { coarseCountry, looksAutomated } from "@/lib/analytics/reader-signal";

export const runtime = "edge";

const analyticsInput = z
  .object({
    eventType: z.enum([
      "PAGE_VIEW",
      "ENGAGED_READING",
      "SCROLL_DEPTH",
      "ARTICLE_COMPLETION",
      "NEWSLETTER_CONVERSION",
      "TOPIC_FOLLOW",
      "SAVE",
      "SHARE",
      "SEARCH",
      "RETURNING_READER",
      "TRAFFIC_SOURCE",
    ]),
    // Article identifiers are `article_<token>`, never UUIDs. Validating them
    // as UUIDs rejected every event that named an article, which is every
    // event worth collecting.
    articleId: z
      .string()
      .regex(/^article_[A-Za-z0-9_-]{10,64}$/u)
      .optional(),
    anonymousId: z.string().min(16).max(128).optional(),
    properties: z
      .object({
        scrollBucket: z.enum(["25", "50", "75", "100"]).optional(),
        sourceType: z
          .enum(["DIRECT", "SEARCH", "SOCIAL", "NEWSLETTER", "REFERRAL", "UNKNOWN"])
          .optional(),
        topicSlug: z.string().regex(/^[a-z0-9-]{1,80}$/u).optional(),
        shareChannel: z.enum(["COPY", "SYSTEM", "EMAIL"]).optional(),
      })
      .strict()
      .default({}),
  })
  .strict();


export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  if (process.env.ANALYTICS_PROVIDER !== "first_party") {
    return new Response(null, { status: 204 });
  }
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.APP_ENV === "production" ? undefined : new URL(request.url).origin,
  ].filter((value): value is string => Boolean(value));
  const protection = validateMutationRequest(request, {
    allowedOrigins,
    allowedMediaTypes: ["application/json"],
  });
  if (!protection.allowed) {
    return apiErrorResponse(
      protection.status === 415 ? "UNSUPPORTED_MEDIA_TYPE" : "FORBIDDEN",
      {
        status: protection.status,
        message: "The analytics event was not accepted.",
        requestId,
      },
    );
  }
  let parsed;
  try {
    parsed = analyticsInput.safeParse(await readAdvertisingJson(request, 4_096));
  } catch {
    parsed = { success: false } as const;
  }
  if (!parsed.success) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Send a supported analytics event.",
      requestId,
    });
  }
  const secret = process.env.ANALYTICS_WRITE_KEY;
  if (!secret || secret.length < 32) {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Analytics storage is not configured.",
      requestId,
    });
  }
  // Automated traffic must be refused at the origin, not only in the browser:
  // a crawler or a script never runs the client guard, and "Most read" would
  // end up ranking whatever visited most rather than what people read.
  if (looksAutomated(request.headers.get("user-agent") ?? "")) {
    return new Response(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
  }
  // Preview/demo and newsroom traffic are never mixed into production reader data.
  if (
    process.env.APP_ENV !== "production" ||
    request.headers.get("x-northline-staff-request") === "1"
  ) {
    return new Response(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
  }
  const anonymousIdHash = parsed.data.anonymousId
    ? await hmacSha256Base64Url(secret, parsed.data.anonymousId)
    : null;
  const country = coarseCountry(request);
  try {
    const db = await getDb();
    await db.insert(analyticsEvents).values({
      id: crypto.randomUUID(),
      eventType: parsed.data.eventType,
      stream: "READER",
      anonymousIdHash,
      articleId: parsed.data.articleId ?? null,
      // Search text, exact location, article body, referrer URLs, and inferred
      // sensitive interests are intentionally absent from the accepted schema.
      // Country is the one addition: Cloudflare's own edge-resolved value,
      // never an IP address or anything the client supplied.
      metadataJson: JSON.stringify(
        country ? { ...parsed.data.properties, country } : parsed.data.properties,
      ),
      occurredAt: new Date(),
    });
  } catch (error) {
    // Analytics is explicitly non-critical: reader actions remain usable. The
    // failure still needs to be visible somewhere, though - a header nothing
    // reads is indistinguishable from success once nobody happens to inspect
    // it, which is how this stayed unnoticed.
    console.error("analytics_event_persist_failed", {
      requestId,
      eventType: parsed.data.eventType,
      message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
    });
    return new Response(null, {
      status: 202,
      headers: {
        "cache-control": "no-store",
        "x-analytics-result": "not-persisted",
      },
    });
  }
  return new Response(null, {
    status: 202,
    headers: { "cache-control": "no-store", "x-request-id": requestId },
  });
}

