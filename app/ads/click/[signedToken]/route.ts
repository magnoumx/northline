import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { adClicks, adImpressions } from "@/db/schema-v2";
import {
  configuredApprovedDestinationHosts,
  validateDeliveryClaims,
} from "@/lib/advertising/event-validation";
import { verifyAdToken } from "@/lib/advertising/tokens";
import { apiErrorResponse } from "@/lib/security/api";
import { hmacSha256Base64Url } from "@/lib/security/crypto";

export const runtime = "edge";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ signedToken: string }> },
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const { signedToken } = await params;
  const tokenSecret = process.env.AD_TOKEN_SECRET;
  const hashSecret = process.env.AD_EVENT_HASH_SECRET;
  if (
    process.env.FEATURE_DIRECT_ADS !== "true" ||
    process.env.AD_GLOBAL_KILL !== "false" ||
    !tokenSecret ||
    tokenSecret.length < 32 ||
    !hashSecret ||
    hashSecret.length < 32
  ) {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Click handling is unavailable.",
      requestId,
    });
  }
  const verification = await verifyAdToken(
    signedToken,
    tokenSecret,
    "CLICK",
  );
  if (!verification.valid || !verification.payload.destination) {
    return apiErrorResponse("FORBIDDEN", {
      status: 403,
      message: "The click token was not accepted.",
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
    .select({ id: adImpressions.id })
    .from(adImpressions)
    .where(eq(adImpressions.adRequestId, verification.payload.requestId))
    .limit(1);
  if (!claims.valid || !impression) {
    return apiErrorResponse("FORBIDDEN", {
      status: 403,
      message: "The click was not linked to an approved impression.",
      requestId,
    });
  }
  const nonceHash = await hmacSha256Base64Url(
    hashSecret,
    verification.payload.jti,
  );
  try {
    await db.insert(adClicks).values({
      id: crypto.randomUUID(),
      impressionId: impression.id,
      tokenNonceHash: nonceHash,
      destinationUrlNormalized: claims.destination.toString(),
      validationState: "RAW",
      billable: false,
      occurredAt: new Date(),
    });
  } catch {
    const [existing] = await db
      .select({ id: adClicks.id })
      .from(adClicks)
      .where(eq(adClicks.tokenNonceHash, nonceHash))
      .limit(1);
    return apiErrorResponse(existing ? "CONFLICT" : "UNAVAILABLE", {
      status: existing ? 409 : 503,
      message: existing
        ? "The click token has already been used."
        : "The click could not be recorded.",
      requestId,
    });
  }
  return new Response(null, {
    status: 302,
    headers: {
      location: claims.destination.toString(),
      "cache-control": "private, no-store",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-request-id": requestId,
    },
  });
}

