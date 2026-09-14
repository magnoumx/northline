import { describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "../../lib/advertising/captcha";
import {
  assessLeadRisk,
  advertisingLeadInput,
  normalizeLead,
} from "../../lib/advertising/leads";
import {
  selectDeliveryCandidate,
  type DeliveryCandidate,
} from "../../lib/advertising/delivery";
import { forecastInventory } from "../../lib/advertising/forecasting";
import {
  assertOrganizationAccess,
  TenantAccessError,
} from "../../lib/advertising/tenant";
import {
  assertEnabledFeatureConfiguration,
  providerCanActivate,
} from "../../lib/advertising/providers";
import {
  assertCampaignChargeAuthorized,
  createStripePaymentProvider,
} from "../../lib/advertising/stripe";

function validLead() {
  return {
    fullName: "Casey Rivera",
    workEmail: "casey@example.org",
    company: "Example Company",
    companyWebsite: "https://example.org/",
    campaignObjective: "Introduce a new service",
    productOrService: "A business software product",
    targetAudience: "US technology readers",
    targetCountries: ["US"],
    preferredCategories: ["Technology"],
    preferredPlacements: ["Article"],
    estimatedBudget: 15_000,
    desiredStartDate: "2026-08-10",
    desiredEndDate: "2026-08-24",
    creativeStatus: "READY",
    sponsoredContentInterest: false,
    newsletterSponsorshipInterest: true,
    message: "Please share conservative availability.",
    consent: true,
    captchaToken: "",
    website: "",
    formStartedAt: Date.now() - 10_000,
  };
}

describe("advertising acquisition security", () => {
  it("validates, normalizes, and detects disposable or honeypot leads", () => {
    const parsed = advertisingLeadInput.parse(validLead());
    const normalized = normalizeLead(parsed);
    expect(normalized.workEmail).toBe("casey@example.org");
    expect(normalized.estimatedBudgetCents).toBe(1_500_000);

    const risky = advertisingLeadInput.parse({
      ...validLead(),
      workEmail: "bot@mailinator.com",
    });
    expect(assessLeadRisk(risky).reject).toBe(true);
  });

  it("rejects unsafe company destinations", () => {
    expect(
      advertisingLeadInput.safeParse({
        ...validLead(),
        companyWebsite: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("verifies Turnstile through the configured adapter", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    expect(
      await verifyTurnstile({
        token: "token",
        secret: "secret",
        required: true,
        fetcher,
      }),
    ).toEqual({ verified: true });
  });
});

describe("campaign workflow, isolation, and forecasting", () => {
  const candidate: DeliveryCandidate = {
    id: "line-1",
    campaignId: "campaign-1",
    placementCode: "ARTICLE_INLINE_1",
    status: "DELIVERING",
    startsAt: new Date("2026-07-01"),
    endsAt: new Date("2026-08-01"),
    priority: 5,
    pacing: "EVEN",
    target: {
      countries: ["US"],
      devices: ["DESKTOP"],
      categories: ["Technology"],
      excludedPages: [],
      excludedSensitiveContent: true,
      sensitiveTraits: [],
    },
    creativeVersionIds: ["creative-version-1"],
    approved: true,
    killed: false,
    creativeVersionId: "creative-version-1",
    creativeWeight: 1,
    pacingAllowsDelivery: true,
    frequencyCapped: false,
  };

  it("selects only an approved, eligible campaign candidate", () => {
    const selection = selectDeliveryCandidate({
      candidates: [candidate, { ...candidate, id: "draft", status: "DRAFT" }],
      placementCode: "ARTICLE_INLINE_1",
      context: {
        country: "US",
        device: "DESKTOP",
        category: "Technology",
        pagePath: "/story/example",
        pageClass: "ARTICLE",
        sensitive: false,
        publisherContentChars: 5_000,
      },
      now: new Date("2026-07-24"),
      featureEnabled: true,
      globalKill: false,
      placementEnabled: true,
      minimumPublisherContentChars: 1_000,
      requestId: "request-1",
    });
    expect(selection.selected?.id).toBe("line-1");
  });

  it("blocks horizontal advertiser IDOR", () => {
    expect(() =>
      assertOrganizationAccess({
        requestedOrganizationId: "org-b",
        sessionOrganizationIds: ["org-a"],
        isStaffWithCommercialAccess: false,
      }),
    ).toThrow(TenantAccessError);
  });

  it("reports conservative ranges and under-delivery risk", () => {
    const result = forecastInventory({
      historicalDailyImpressions: Array.from({ length: 20 }, (_, index) => 900 + index * 10),
      days: 7,
      alreadyReserved: 2_000,
      requested: 8_000,
    });
    expect(result.confidence).toBe("MEDIUM");
    expect(result.underdeliveryRisk).toBe("HIGH");
    expect(result.assumptions.at(-1)).toContain("not a delivery guarantee");
  });

  it("fails startup validation when an enabled commercial feature lacks secrets", () => {
    expect(() =>
      assertEnabledFeatureConfiguration({ FEATURE_DIRECT_ADS: "true" }),
    ).toThrow(/AD_TOKEN_SECRET/);
    expect(
      providerCanActivate({
        provider: "GOOGLE_ADSENSE",
        approved: false,
        privacyReviewed: true,
        consentReviewed: true,
        cspReviewed: true,
        performanceTested: true,
        async select() {
          return null;
        },
      }),
    ).toBe(false);
  });

  it("requires commercial approvals before payment and uses an idempotent provider adapter", async () => {
    expect(() =>
      assertCampaignChargeAuthorized({
        termsAccepted: true,
        creativeApproved: false,
        totalPriceClear: true,
        refundRulesVisible: true,
        cancellationRulesVisible: true,
      }),
    ).toThrow(/requires accepted terms/i);

    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ id: "pi_123", status: "requires_payment_method" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const provider = createStripePaymentProvider({
      secretKey: "sk_test_abcdefghijklmnopqrstuvwxyz",
      fetcher,
    });
    const result = await provider.createPaymentIntent({
      invoiceId: "invoice-1",
      amountCents: 12_500,
      currency: "USD",
      idempotencyKey: "invoice:invoice-1:v1",
    });
    expect(result.providerReference).toBe("pi_123");
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
