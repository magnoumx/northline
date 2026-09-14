import { and, eq, gt, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { advertisingLeads, commercialAuditLogs } from "@/db/schema-v2";
import { AdvertisingBodyError, readAdvertisingJson } from "@/lib/advertising/body";
import { verifyTurnstile } from "@/lib/advertising/captcha";
import {
  advertisingLeadInput,
  assessLeadRisk,
  normalizeLead,
} from "@/lib/advertising/leads";
import { sendLeadNotifications } from "@/lib/advertising/lead-notifications";
import { enforceAdvertisingLeadRateLimit } from "@/lib/advertising/rate-limit";
import { apiErrorResponse } from "@/lib/security/api";
import { hmacSha256Base64Url } from "@/lib/security/crypto";
import { validateMutationRequest } from "@/lib/security/origin";
import { resolveAttestedClientAddress } from "@/lib/security/request-trust";

export const runtime = "edge";

const noStore = { "cache-control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  const requestOrigin = new URL(request.url).origin;
  const allowedOrigins = [
    configuredOrigin,
    process.env.AD_LEAD_ALLOWED_ORIGIN,
    process.env.APP_ENV === "production" ? undefined : requestOrigin,
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
        message:
          protection.status === 415
            ? "Send the campaign request as JSON."
            : "The campaign request origin was not accepted.",
        requestId,
      },
    );
  }

  let raw: unknown;
  try {
    raw = await readAdvertisingJson(request);
  } catch (error) {
    const tooLarge =
      error instanceof AdvertisingBodyError && error.kind === "TOO_LARGE";
    return apiErrorResponse(tooLarge ? "PAYLOAD_TOO_LARGE" : "BAD_REQUEST", {
      status: tooLarge ? 413 : 400,
      message: tooLarge
        ? "The campaign request was larger than expected."
        : "Send a valid campaign request.",
      requestId,
    });
  }

  const parsed = advertisingLeadInput.safeParse(raw);
  if (!parsed.success) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Review the highlighted campaign request fields.",
      requestId,
    });
  }
  const lead = normalizeLead(parsed.data);
  const now = new Date();
  const production = process.env.APP_ENV === "production";
  const clientAddress = await resolveAttestedClientAddress(request.headers);
  const captcha = await verifyTurnstile({
    token: lead.captchaToken,
    secret: process.env.TURNSTILE_SECRET_KEY,
    remoteAddress: clientAddress,
    required:
      production && process.env.CAPTCHA_REQUIRED?.toLowerCase() !== "false",
  });
  if (!captcha.verified) {
    return apiErrorResponse(
      captcha.reason === "UNAVAILABLE" ||
        captcha.reason === "MISSING_CONFIGURATION"
        ? "UNAVAILABLE"
        : "FORBIDDEN",
      {
        status:
          captcha.reason === "UNAVAILABLE" ||
          captcha.reason === "MISSING_CONFIGURATION"
            ? 503
            : 403,
        message:
          captcha.reason === "UNAVAILABLE" ||
          captcha.reason === "MISSING_CONFIGURATION"
            ? "Campaign request verification is temporarily unavailable."
            : "Campaign request verification was not accepted.",
        requestId,
      },
    );
  }

  const rateLimitSecret =
    process.env.RATE_LIMIT_SECRET ?? process.env.AD_LEAD_HASH_SECRET;
  if (!rateLimitSecret || rateLimitSecret.length < 32) {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Campaign requests are temporarily unavailable.",
      requestId,
    });
  }

  let db: Awaited<ReturnType<typeof getDb>>;
  try {
    db = await getDb();
    const rateLimit = await enforceAdvertisingLeadRateLimit({
      db,
      email: lead.workEmail,
      clientAddress,
      secret: rateLimitSecret,
      now,
    });
    if (!rateLimit.allowed) {
      return apiErrorResponse("RATE_LIMITED", {
        status: 429,
        message: "Too many campaign requests. Please try again later.",
        requestId,
        headers: { "retry-after": String(rateLimit.retryAfterSeconds) },
      });
    }
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Campaign request storage is temporarily unavailable.",
      requestId,
    });
  }

  const emailHash = await hmacSha256Base64Url(
    process.env.AD_LEAD_HASH_SECRET ?? rateLimitSecret,
    lead.workEmail,
  );
  const duplicateCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);
  const [duplicate] = await db
    .select({ id: advertisingLeads.id })
    .from(advertisingLeads)
    .where(
      and(
        eq(advertisingLeads.emailHash, emailHash),
        gt(advertisingLeads.createdAt, duplicateCutoff),
        ne(advertisingLeads.status, "SPAM"),
      ),
    )
    .limit(1);
  const risk = assessLeadRisk(lead, now.getTime());
  const id = crypto.randomUUID();
  const status = risk.reject ? "SPAM" : duplicate ? "ARCHIVED" : "NEW";
  const ipHash =
    clientAddress === "unavailable"
      ? null
      : await hmacSha256Base64Url(rateLimitSecret, clientAddress);

  try {
    await db.batch([
      db.insert(advertisingLeads).values({
        id,
        emailHash,
        fullName: lead.fullName,
        workEmail: lead.workEmail,
        company: lead.company,
        companyWebsite: lead.companyWebsite,
        campaignObjective: lead.campaignObjective,
        productOrService: lead.productOrService,
        targetAudience: lead.targetAudience,
        targetCountriesJson: JSON.stringify(lead.targetCountries),
        preferredCategoriesJson: JSON.stringify(lead.preferredCategories),
        preferredPlacementsJson: JSON.stringify(lead.preferredPlacements),
        estimatedBudgetCents: lead.estimatedBudgetCents,
        desiredStartAt: lead.desiredStartAt,
        desiredEndAt: lead.desiredEndAt,
        creativeStatus: lead.creativeStatus,
        sponsoredContentInterest: lead.sponsoredContentInterest,
        newsletterSponsorshipInterest: lead.newsletterSponsorshipInterest,
        message: lead.message || null,
        consentedAt: now,
        status,
        duplicateOfId: duplicate?.id ?? null,
        spamScore: risk.spamScore,
        sourceIpHash: ipHash,
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(commercialAuditLogs).values({
        id: crypto.randomUUID(),
        advertiserOrganizationId: null,
        action: "ADVERTISING_LEAD_RECEIVED",
        targetType: "AdvertisingLead",
        targetId: id,
        decision: status,
        reason:
          risk.reasons.join(",") ||
          (duplicate ? "DUPLICATE_WITHIN_30_DAYS" : "VALIDATED_SUBMISSION"),
        metadataJson: JSON.stringify({
          requestId,
          captcha: "verified",
          duplicate: Boolean(duplicate),
        }),
        ipHash,
        occurredAt: now,
      }),
    ]);
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Campaign request storage is temporarily unavailable.",
      requestId,
    });
  }

  let notifications: "SENT" | "NOT_CONFIGURED" | "FAILED" = "NOT_CONFIGURED";
  if (status === "NEW") {
    const result = await sendLeadNotifications({
      leadId: id,
      lead,
      environment: {
        EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
        EMAIL_API_KEY: process.env.EMAIL_API_KEY,
        EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS,
        SALES_NOTIFICATION_EMAIL: process.env.SALES_NOTIFICATION_EMAIL,
      },
    });
    notifications = result.status;
  }

  return Response.json(
    {
      accepted: true,
      reference: status === "NEW" ? id : undefined,
      message:
        "Your request has been received for review. No inventory or pricing is guaranteed.",
      notifications:
        notifications === "SENT"
          ? "sent"
          : notifications === "FAILED"
            ? "delivery_delayed"
            : "not_configured",
    },
    {
      status: 202,
      headers: {
        ...noStore,
        "x-request-id": requestId,
      },
    },
  );
}

