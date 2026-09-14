import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  adImpressions,
  viewableImpressions,
} from "@/db/schema-v2";
import {
  configuredApprovedDestinationHosts,
  validateDeliveryClaims,
} from "@/lib/advertising/event-validation";
import {
  readProtectedEvent,
  viewabilityEventInput,
} from "@/lib/advertising/event-request";
import { verifyAdToken } from "@/lib/advertising/tokens";
import { apiErrorResponse } from "@/lib/security/api";
import { hmacSha256Base64Url } from "@/lib/security/crypto";

export const runtime = "edge";

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const input = await readProtectedEvent(
    request,
    viewabilityEventInput,
    requestId,
  );
  if (!input.valid) return input.response;
  const tokenSecret = process.env.AD_TOKEN_SECRET;
  const hashSecret = process.env.AD_EVENT_HASH_SECRET;
  if (
    process.env.FEATURE_DIRECT_ADS !== "true" ||
    !tokenSecret ||
    tokenSecret.length < 32 ||
    !hashSecret ||
    hashSecret.length < 32
  ) {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Advertising events are not configured.",
      requestId,
    });
  }
  const verification = await verifyAdToken(
    input.data.token,
    tokenSecret,
    "VIEWABILITY",
  );
  if (!verification.valid) {
    return apiErrorResponse("FORBIDDEN", {
      status: 403,
      message: "The viewability token was not accepted.",
      requestId,
    });
  }
  const db = await getDb();
  const claims = await validateDeliveryClaims(
    db,
    verification.payload,
    configuredApprovedDestinationHosts(),
  );
  const [impression] = await db
    .select({
      id: adImpressions.id,
      lineItemId: adImpressions.lineItemId,
      creativeVersionId: adImpressions.creativeVersionId,
    })
    .from(adImpressions)
    .where(eq(adImpressions.adRequestId, verification.payload.requestId))
    .limit(1);
  if (
    !claims.valid ||
    !impression ||
    impression.lineItemId !== verification.payload.lineItemId ||
    impression.creativeVersionId !== verification.payload.creativeVersionId
  ) {
    return apiErrorResponse("FORBIDDEN", {
      status: 403,
      message: "The viewability event was not linked to a valid impression.",
      requestId,
    });
  }
  const nonceHash = await hmacSha256Base64Url(
    hashSecret,
    verification.payload.jti,
  );
  const id = crypto.randomUUID();
  try {
    await db.insert(viewableImpressions).values({
      id,
      impressionId: impression.id,
      tokenNonceHash: nonceHash,
      visiblePercent: input.data.visiblePercent,
      visibleMilliseconds: input.data.visibleMilliseconds,
      validated: false,
      occurredAt: new Date(),
    });
  } catch {
    const [existing] = await db
      .select({ id: viewableImpressions.id })
      .from(viewableImpressions)
      .where(
        and(
          eq(viewableImpressions.impressionId, impression.id),
          eq(viewableImpressions.tokenNonceHash, nonceHash),
        ),
      )
      .limit(1);
    return apiErrorResponse(existing ? "CONFLICT" : "UNAVAILABLE", {
      status: existing ? 409 : 503,
      message: existing
        ? "The viewability token has already been used."
        : "The viewability event could not be recorded.",
      requestId,
    });
  }
  return Response.json(
    { accepted: true, eventId: id, state: "raw_not_billable" },
    {
      status: 202,
      headers: { "cache-control": "no-store", "x-request-id": requestId },
    },
  );
}

