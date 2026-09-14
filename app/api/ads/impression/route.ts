import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import {
  adImpressions,
  adRequests,
  invalidTrafficEvents,
} from "@/db/schema-v2";
import {
  configuredApprovedDestinationHosts,
  validateDeliveryClaims,
} from "@/lib/advertising/event-validation";
import {
  readProtectedEvent,
  signedEventInput,
} from "@/lib/advertising/event-request";
import { classifyTraffic } from "@/lib/advertising/fraud";
import { verifyAdToken } from "@/lib/advertising/tokens";
import { apiErrorResponse } from "@/lib/security/api";
import { hmacSha256Base64Url } from "@/lib/security/crypto";
import { resolveAttestedClientAddress } from "@/lib/security/request-trust";

export const runtime = "edge";

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const input = await readProtectedEvent(request, signedEventInput, requestId);
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
    "IMPRESSION",
  );
  if (!verification.valid) {
    return apiErrorResponse("FORBIDDEN", {
      status: 403,
      message: "The impression token was not accepted.",
      requestId,
    });
  }
  const db = await getDb();
  const claims = await validateDeliveryClaims(
    db,
    verification.payload,
    configuredApprovedDestinationHosts(),
  );
  const [adRequest] = await db
    .select({
      id: adRequests.id,
      lineItemId: adRequests.lineItemId,
      creativeVersionId: adRequests.creativeVersionId,
    })
    .from(adRequests)
    .where(eq(adRequests.id, verification.payload.requestId))
    .limit(1);
  if (
    !claims.valid ||
    !adRequest ||
    adRequest.lineItemId !== verification.payload.lineItemId ||
    adRequest.creativeVersionId !== verification.payload.creativeVersionId
  ) {
    return apiErrorResponse("FORBIDDEN", {
      status: 403,
      message: "The impression was not linked to an approved delivery.",
      requestId,
    });
  }
  const nonceHash = await hmacSha256Base64Url(
    hashSecret,
    verification.payload.jti,
  );
  const impressionId = crypto.randomUUID();
  const clientAddress = await resolveAttestedClientAddress(request.headers);
  const signedIn = Boolean(await getChatGPTUser());
  const traffic = classifyTraffic({
    userAgent: request.headers.get("user-agent") ?? "",
    isInternalAddress:
      clientAddress !== "unavailable" &&
      (process.env.AD_INTERNAL_IP_RANGES ?? "")
        .split(",")
        .map((value) => value.trim())
        .includes(clientAddress),
    isAdminSession: signedIn,
    eventsForToken: 1,
    requestsForAddressInMinute: 0,
    impressions: 1,
    clicks: 0,
    dataCenterAddress: false,
  });
  const now = new Date();
  try {
    const impression = db.insert(adImpressions).values({
      id: impressionId,
      adRequestId: adRequest.id,
      tokenNonceHash: nonceHash,
      lineItemId: verification.payload.lineItemId,
      creativeVersionId: verification.payload.creativeVersionId,
      validationState: traffic.excluded ? "EXCLUDED" : "RAW",
      billable: false,
      occurredAt: now,
    });
    if (traffic.excluded) {
      await db.batch([
        impression,
        db.insert(invalidTrafficEvents).values({
          id: crypto.randomUUID(),
          eventType: "IMPRESSION",
          eventId: impressionId,
          reasonCode: traffic.reasons[0] ?? traffic.classification,
          riskScore: traffic.riskScore,
          detector: "REQUEST_CLASSIFIER_V1",
          evidenceJson: JSON.stringify({
            reasons: traffic.reasons,
            classification: traffic.classification,
          }),
          occurredAt: now,
        }),
      ]);
    } else {
      await impression;
    }
  } catch {
    const [existing] = await db
      .select({ id: adImpressions.id })
      .from(adImpressions)
      .where(
        and(
          eq(adImpressions.adRequestId, adRequest.id),
          eq(adImpressions.tokenNonceHash, nonceHash),
        ),
      )
      .limit(1);
    return apiErrorResponse(existing ? "CONFLICT" : "UNAVAILABLE", {
      status: existing ? 409 : 503,
      message: existing
        ? "The impression token has already been used."
        : "The impression could not be recorded.",
      requestId,
    });
  }
  return Response.json(
    {
      accepted: true,
      eventId: impressionId,
      state: traffic.excluded ? "excluded" : "raw_not_billable",
    },
    {
      status: 202,
      headers: { "cache-control": "no-store", "x-request-id": requestId },
    },
  );
}

