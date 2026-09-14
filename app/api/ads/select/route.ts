import {
  and,
  count,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lte,
  sum,
} from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { articleVersions, articles } from "@/db/schema";
import {
  adPlacements,
  adRequests,
  campaignDeliveries,
  campaigns,
  creativeApprovals,
  creatives,
  creativeVersions,
  frequencyCaps,
  lineItemCreatives,
  lineItems,
  targetingRules,
} from "@/db/schema-v2";
import { readAdvertisingJson } from "@/lib/advertising/body";
import {
  selectDeliveryCandidate,
  type DeliveryCandidate,
} from "@/lib/advertising/delivery";
import { parseApprovedDestinationHosts, validateAdvertiserDestination } from "@/lib/advertising/destinations";
import { classifyTraffic } from "@/lib/advertising/fraud";
import { evaluatePacing, isFrequencyCapped } from "@/lib/advertising/pacing";
import { signAdToken } from "@/lib/advertising/tokens";
import {
  placementCodes,
  type DeviceClass,
  type PlacementCode,
  type TargetingContext,
  type TargetingPolicy,
} from "@/lib/advertising/types";
import { apiErrorResponse } from "@/lib/security/api";
import { hmacSha256Base64Url } from "@/lib/security/crypto";
import { sanitizeRestrictedHtml } from "@/lib/security/html";
import { validateMutationRequest } from "@/lib/security/origin";
import { resolveAttestedClientAddress } from "@/lib/security/request-trust";

export const runtime = "edge";

const selectionInput = z
  .object({
    placement: z.enum(placementCodes),
    pagePath: z.string().min(1).max(1_024).regex(/^\/(?!\/)/u),
    pageClass: z.enum(["HOME", "LATEST", "TRENDING", "CATEGORY", "ARTICLE"]),
    articleId: z.string().uuid().optional(),
    category: z.string().trim().max(80).optional(),
    anonymousId: z.string().trim().min(16).max(128).optional(),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const featureEnabled = process.env.FEATURE_DIRECT_ADS === "true";
  const globallyKilled = process.env.AD_GLOBAL_KILL !== "false";
  if (!featureEnabled || globallyKilled) return emptyResponse("feature-disabled");

  const tokenSecret = process.env.AD_TOKEN_SECRET;
  const eventHashSecret = process.env.AD_EVENT_HASH_SECRET;
  if (!tokenSecret || tokenSecret.length < 32 || !eventHashSecret || eventHashSecret.length < 32) {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Advertising delivery is not configured.",
      requestId,
    });
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
        message: "The ad request was not accepted.",
        requestId,
      },
    );
  }

  let parsed;
  try {
    parsed = selectionInput.safeParse(await readAdvertisingJson(request, 8_192));
  } catch {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Send a valid ad request.",
      requestId,
    });
  }
  if (!parsed.success) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Send a valid ad request.",
      requestId,
    });
  }

  const db = await getDb();
  const now = new Date();
  const [placement] = await db
    .select()
    .from(adPlacements)
    .where(eq(adPlacements.code, parsed.data.placement))
    .limit(1);
  if (!placement || !placement.enabled || placement.killedAt) {
    return emptyResponse("placement-unavailable");
  }

  const trustedPage = await resolvePageContext({
    db,
    input: parsed.data,
    request,
  });
  if (!trustedPage) return emptyResponse("page-suppressed");

  const clientAddress = await resolveAttestedClientAddress(request.headers);
  const traffic = classifyTraffic({
    userAgent: request.headers.get("user-agent") ?? "",
    isInternalAddress: matchesInternalAddress(
      clientAddress,
      process.env.AD_INTERNAL_IP_RANGES,
    ),
    isAdminSession: false,
    eventsForToken: 0,
    requestsForAddressInMinute: 0,
    impressions: 0,
    clicks: 0,
    dataCenterAddress: false,
  });
  const anonymousViewerHash = parsed.data.anonymousId
    ? await hmacSha256Base64Url(eventHashSecret, parsed.data.anonymousId)
    : null;
  const clientIpHash =
    clientAddress === "unavailable"
      ? null
      : await hmacSha256Base64Url(eventHashSecret, clientAddress);
  if (traffic.excluded) {
    await db.insert(adRequests).values({
      id: requestId,
      placementId: placement.id,
      pageClass: trustedPage.pageClass,
      country: trustedPage.country,
      device: trustedPage.device,
      anonymousViewerHash,
      clientIpHash,
      selectionReason: traffic.classification,
      isInternal: traffic.classification === "INTERNAL",
      isCrawler: traffic.classification === "CRAWLER",
      occurredAt: now,
    });
    return emptyResponse("traffic-excluded");
  }

  const rows = await db
    .select({
      lineItemId: lineItems.id,
      campaignId: lineItems.campaignId,
      status: lineItems.status,
      startsAt: lineItems.startsAt,
      endsAt: lineItems.endsAt,
      priority: lineItems.priority,
      pacing: lineItems.pacing,
      contractedImpressions: lineItems.contractedImpressions,
      approvedAt: lineItems.approvedAt,
      placementCode: adPlacements.code,
      campaignApprovedAt: campaigns.approvedAt,
      campaignTermsAt: campaigns.termsAcceptedAt,
      campaignKilledAt: campaigns.killedAt,
      targetCountries: targetingRules.countriesJson,
      targetDevices: targetingRules.devicesJson,
      targetCategories: targetingRules.categoriesJson,
      excludedPages: targetingRules.excludedPagesJson,
      excludeSensitive: targetingRules.excludedSensitiveContent,
      sensitiveTraits: targetingRules.sensitiveTraitsJson,
      capMaximumViews: frequencyCaps.maximumViews,
      capWindowSeconds: frequencyCaps.windowSeconds,
      creativeId: creatives.id,
      creativeType: creatives.creativeType,
      creativeStatus: creatives.status,
      creativeKilledAt: creatives.killedAt,
      destination: creatives.destinationUrlNormalized,
      creativeVersionId: creativeVersions.id,
      creativeVersion: creativeVersions.version,
      creativeHash: creativeVersions.contentHash,
      storageKey: creativeVersions.storageKey,
      sanitizedMarkup: creativeVersions.sanitizedMarkup,
      nativePayload: creativeVersions.nativePayloadJson,
      mimeType: creativeVersions.mimeType,
      width: creativeVersions.width,
      height: creativeVersions.height,
      scanStatus: creativeVersions.scanStatus,
      creativeWeight: lineItemCreatives.weight,
      approvalDecision: creativeApprovals.decision,
      approvalOccurredAt: creativeApprovals.occurredAt,
    })
    .from(lineItems)
    .innerJoin(campaigns, eq(campaigns.id, lineItems.campaignId))
    .innerJoin(adPlacements, eq(adPlacements.id, lineItems.placementId))
    .innerJoin(lineItemCreatives, eq(lineItemCreatives.lineItemId, lineItems.id))
    .innerJoin(creatives, eq(creatives.id, lineItemCreatives.creativeId))
    .innerJoin(creativeVersions, eq(creativeVersions.creativeId, creatives.id))
    .innerJoin(
      creativeApprovals,
      eq(creativeApprovals.creativeVersionId, creativeVersions.id),
    )
    .leftJoin(targetingRules, eq(targetingRules.id, lineItems.targetingRuleId))
    .leftJoin(frequencyCaps, eq(frequencyCaps.id, lineItems.frequencyCapId))
    .where(
      and(
        eq(adPlacements.id, placement.id),
        inArray(lineItems.status, ["READY", "DELIVERING"]),
        inArray(campaigns.status, ["APPROVED", "READY", "DELIVERING"]),
        lte(lineItems.startsAt, now),
        gt(lineItems.endsAt, now),
        isNull(campaigns.killedAt),
        isNull(creatives.killedAt),
      ),
    );

  const latestApproval = new Map<
    string,
    { decision: string; occurredAt: Date }
  >();
  for (const row of rows) {
    const current = latestApproval.get(row.creativeVersionId);
    if (!current || row.approvalOccurredAt > current.occurredAt) {
      latestApproval.set(row.creativeVersionId, {
        decision: row.approvalDecision,
        occurredAt: row.approvalOccurredAt,
      });
    }
  }

  const candidates: DeliveryCandidate[] = [];
  const candidateRows = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (
      latestApproval.get(row.creativeVersionId)?.decision !== "APPROVED" ||
      row.creativeStatus !== "APPROVED" ||
      row.scanStatus !== "APPROVED" ||
      !row.approvedAt ||
      !row.campaignApprovedAt ||
      !row.campaignTermsAt
    ) {
      continue;
    }
    const key = `${row.lineItemId}:${row.creativeVersionId}`;
    if (candidateRows.has(key)) continue;
    const [delivery] = row.contractedImpressions
      ? await db
          .select({ served: sum(campaignDeliveries.served) })
          .from(campaignDeliveries)
          .where(eq(campaignDeliveries.lineItemId, row.lineItemId))
      : [{ served: null }];
    const pacingAllowsDelivery = row.contractedImpressions
      ? evaluatePacing({
          now,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          goalUnits: row.contractedImpressions,
          deliveredUnits: Number(delivery?.served ?? 0),
          pacing: row.pacing === "ASAP" ? "ASAP" : "EVEN",
        }).shouldServe
      : true;
    const frequencyCapped =
      row.capMaximumViews && row.capWindowSeconds
        ? await evaluateFrequencyCap({
            db,
            lineItemId: row.lineItemId,
            anonymousViewerHash,
            maximumViews: row.capMaximumViews,
            windowSeconds: row.capWindowSeconds,
            now,
          })
        : false;
    const target = parseTarget(row);
    candidates.push({
      id: row.lineItemId,
      campaignId: row.campaignId,
      placementCode: row.placementCode as PlacementCode,
      status: row.status as DeliveryCandidate["status"],
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      priority: row.priority,
      pacing: row.pacing === "ASAP" ? "ASAP" : "EVEN",
      target,
      creativeVersionIds: [row.creativeVersionId],
      approved: true,
      killed: Boolean(row.campaignKilledAt || row.creativeKilledAt),
      creativeVersionId: row.creativeVersionId,
      creativeWeight: row.creativeWeight,
      pacingAllowsDelivery,
      frequencyCapped,
    });
    candidateRows.set(key, row);
  }

  const result = selectDeliveryCandidate({
    candidates,
    placementCode: parsed.data.placement,
    context: trustedPage,
    now,
    featureEnabled,
    globalKill: globallyKilled,
    placementEnabled: placement.enabled,
    minimumPublisherContentChars: placement.sensitiveContentPolicy === "NO_ARTICLE_ADS"
      ? Number.MAX_SAFE_INTEGER
      : 800,
    requestId,
  });
  if (!result.selected) {
    await db.insert(adRequests).values({
      id: requestId,
      placementId: placement.id,
      pageClass: trustedPage.pageClass,
      country: trustedPage.country,
      device: trustedPage.device,
      anonymousViewerHash,
      clientIpHash,
      selectionReason:
        result.evaluations[0]?.decision.reason ?? "NO_ELIGIBLE_CAMPAIGN",
      occurredAt: now,
    });
    return emptyResponse("no-fill");
  }

  const selectedRow = candidateRows.get(
    `${result.selected.id}:${result.selected.creativeVersionId}`,
  );
  if (!selectedRow) return emptyResponse("no-fill");
  const destination = validateAdvertiserDestination(
    selectedRow.destination,
    parseApprovedDestinationHosts(process.env.AD_APPROVED_DESTINATION_HOSTS),
  );
  if (!destination.valid) return emptyResponse("destination-rejected");
  const creative = buildSafeCreative(selectedRow, process.env.R2_PUBLIC_BASE_URL);
  if (!creative) return emptyResponse("creative-unavailable");

  await db.insert(adRequests).values({
    id: requestId,
    placementId: placement.id,
    lineItemId: result.selected.id,
    creativeVersionId: result.selected.creativeVersionId,
    pageClass: trustedPage.pageClass,
    country: trustedPage.country,
    device: trustedPage.device,
    anonymousViewerHash,
    clientIpHash,
    selectionReason: "DIRECT_GUARANTEED_ELIGIBLE",
    occurredAt: now,
  });

  const issuedAt = Math.floor(now.getTime() / 1_000);
  const tokenBase = {
    iat: issuedAt,
    exp: issuedAt + 15 * 60,
    requestId,
    campaignId: result.selected.campaignId,
    lineItemId: result.selected.id,
    creativeVersionId: result.selected.creativeVersionId,
  };
  const [impressionToken, viewabilityToken, clickToken] = await Promise.all([
    signAdToken(
      { ...tokenBase, purpose: "IMPRESSION", jti: crypto.randomUUID() },
      tokenSecret,
    ),
    signAdToken(
      { ...tokenBase, purpose: "VIEWABILITY", jti: crypto.randomUUID() },
      tokenSecret,
    ),
    signAdToken(
      {
        ...tokenBase,
        purpose: "CLICK",
        jti: crypto.randomUUID(),
        destination: destination.url.toString(),
      },
      tokenSecret,
    ),
  ]);
  return Response.json(
    {
      requestId,
      label: "Advertisement",
      creative,
      impressionToken,
      viewabilityToken,
      clickUrl: `/ads/click/${encodeURIComponent(clickToken)}`,
    },
    { headers: { "cache-control": "private, no-store", "x-request-id": requestId } },
  );
}

async function resolvePageContext({
  db,
  input,
  request,
}: {
  db: Awaited<ReturnType<typeof getDb>>;
  input: z.infer<typeof selectionInput>;
  request: Request;
}): Promise<TargetingContext | null> {
  const expectedPath =
    input.pageClass === "HOME"
      ? input.pagePath === "/"
      : input.pageClass === "LATEST"
        ? input.pagePath === "/latest"
        : input.pageClass === "TRENDING"
          ? input.pagePath === "/trending"
          : input.pageClass === "CATEGORY"
            ? input.pagePath.startsWith("/news/")
            : Boolean(input.articleId);
  if (!expectedPath) return null;
  let sensitive = false;
  let publisherContentChars = input.pageClass === "ARTICLE" ? 0 : 4_000;
  let category = input.category;
  if (input.pageClass === "ARTICLE") {
    if (!input.articleId) return null;
    const [record] = await db
      .select({
        sensitive: articles.sensitive,
        state: articles.state,
        category: articles.category,
        bodyJson: articleVersions.bodyJson,
      })
      .from(articles)
      .innerJoin(articleVersions, eq(articleVersions.id, articles.currentVersionId))
      .where(eq(articles.id, input.articleId))
      .limit(1);
    if (
      !record ||
      record.state === "RETRACTED" ||
      !["PUBLISHED", "DEVELOPING", "UPDATED", "CORRECTED"].includes(record.state)
    ) {
      return null;
    }
    sensitive = record.sensitive;
    publisherContentChars = record.bodyJson.length;
    category = record.category;
  }
  const cloudflare = (request as Request & { cf?: { country?: unknown } }).cf;
  const country =
    typeof cloudflare?.country === "string" && /^[A-Z]{2}$/u.test(cloudflare.country)
      ? cloudflare.country
      : "UNKNOWN";
  return {
    country,
    device: deviceFromUserAgent(request.headers.get("user-agent") ?? ""),
    category,
    pagePath: input.pagePath,
    pageClass: input.pageClass,
    sensitive,
    publisherContentChars,
  };
}

async function evaluateFrequencyCap({
  db,
  lineItemId,
  anonymousViewerHash,
  maximumViews,
  windowSeconds,
  now,
}: {
  db: Awaited<ReturnType<typeof getDb>>;
  lineItemId: string;
  anonymousViewerHash: string | null;
  maximumViews: number;
  windowSeconds: number;
  now: Date;
}) {
  if (!anonymousViewerHash) return true;
  const [result] = await db
    .select({ value: count() })
    .from(adRequests)
    .where(
      and(
        eq(adRequests.lineItemId, lineItemId),
        eq(adRequests.anonymousViewerHash, anonymousViewerHash),
        gte(
          adRequests.occurredAt,
          new Date(now.getTime() - windowSeconds * 1_000),
        ),
      ),
    );
  return isFrequencyCapped({
    eventTimes: Array.from(
      { length: result?.value ?? 0 },
      () => now,
    ),
    now,
    maximumViews,
    windowSeconds,
  });
}

function parseTarget(row: {
  targetCountries: string | null;
  targetDevices: string | null;
  targetCategories: string | null;
  excludedPages: string | null;
  excludeSensitive: boolean | null;
  sensitiveTraits: string | null;
}): TargetingPolicy {
  return {
    countries: parseStringArray(row.targetCountries),
    devices: parseStringArray(row.targetDevices).filter(isDevice),
    categories: parseStringArray(row.targetCategories),
    excludedPages: parseStringArray(row.excludedPages),
    excludedSensitiveContent: row.excludeSensitive ?? true,
    sensitiveTraits: parseStringArray(row.sensitiveTraits),
  };
}

function parseStringArray(value: string | null): string[] {
  try {
    const parsed = JSON.parse(value ?? "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function isDevice(value: string): value is DeviceClass {
  return ["MOBILE", "TABLET", "DESKTOP", "UNKNOWN"].includes(value);
}

function deviceFromUserAgent(userAgent: string): DeviceClass {
  if (/ipad|tablet/i.test(userAgent)) return "TABLET";
  if (/mobile|iphone|android/i.test(userAgent)) return "MOBILE";
  return userAgent ? "DESKTOP" : "UNKNOWN";
}

function matchesInternalAddress(address: string, configured: string | undefined): boolean {
  return (
    address !== "unavailable" &&
    (configured ?? "")
      .split(",")
      .map((value) => value.trim())
      .includes(address)
  );
}

function buildSafeCreative(
  row: {
    creativeType: string;
    storageKey: string | null;
    sanitizedMarkup: string | null;
    nativePayload: string | null;
    mimeType: string;
    width: number | null;
    height: number | null;
    creativeHash: string;
  },
  publicBase: string | undefined,
): Record<string, unknown> | null {
  if (row.creativeType === "IMAGE") {
    if (!row.storageKey || !publicBase || !/^image\/(?:png|jpeg|webp)$/u.test(row.mimeType)) {
      return null;
    }
    try {
      const base = new URL(publicBase);
      if (base.protocol !== "https:") return null;
      const encodedKey = row.storageKey
        .split("/")
        .filter((part) => part && part !== "." && part !== "..")
        .map(encodeURIComponent)
        .join("/");
      const assetUrl = new URL(encodedKey, `${base.toString().replace(/\/?$/u, "/")}`);
      if (assetUrl.origin !== base.origin) return null;
      return {
        type: "IMAGE",
        assetUrl: assetUrl.toString(),
        mimeType: row.mimeType,
        width: row.width,
        height: row.height,
        alt: "Advertisement",
        contentHash: row.creativeHash,
      };
    } catch {
      return null;
    }
  }
  if (row.creativeType === "NATIVE_CARD") {
    try {
      const payload = JSON.parse(row.nativePayload ?? "") as Record<string, unknown>;
      const headline = typeof payload.headline === "string" ? payload.headline.slice(0, 120) : "";
      const body = typeof payload.body === "string" ? payload.body.slice(0, 240) : "";
      const callToAction =
        typeof payload.callToAction === "string" ? payload.callToAction.slice(0, 40) : "";
      return headline && callToAction
        ? {
            type: "NATIVE_CARD",
            headline,
            body,
            callToAction,
            contentHash: row.creativeHash,
          }
        : null;
    } catch {
      return null;
    }
  }
  if (row.creativeType === "HTML_SANITIZED" && row.sanitizedMarkup) {
    return {
      type: "HTML_SANITIZED",
      html: sanitizeRestrictedHtml(row.sanitizedMarkup),
      sandbox: "",
      contentHash: row.creativeHash,
    };
  }
  return null;
}

function emptyResponse(reason: string): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "cache-control": "private, no-store",
      "x-ad-result": reason,
    },
  });
}

