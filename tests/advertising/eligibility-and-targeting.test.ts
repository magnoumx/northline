import { describe, expect, it } from "vitest";
import {
  evaluateEligibility,
  targetMatches,
} from "../../lib/advertising/eligibility";
import type {
  EligibleLineItem,
  TargetingContext,
  TargetingPolicy,
} from "../../lib/advertising/types";

const target: TargetingPolicy = {
  countries: ["US"],
  devices: ["MOBILE"],
  categories: ["Technology"],
  excludedPages: ["/corrections*", "/preview*"],
  excludedSensitiveContent: true,
  sensitiveTraits: [],
};

const context: TargetingContext = {
  country: "US",
  device: "MOBILE",
  category: "Technology",
  pagePath: "/story/example",
  pageClass: "ARTICLE",
  sensitive: false,
  publisherContentChars: 8_000,
};

const lineItem: EligibleLineItem = {
  id: "line-1",
  campaignId: "campaign-1",
  placementCode: "ARTICLE_INLINE_1",
  status: "DELIVERING",
  startsAt: new Date("2026-07-01T00:00:00Z"),
  endsAt: new Date("2026-08-01T00:00:00Z"),
  priority: 7,
  pacing: "EVEN",
  target,
  creativeVersionIds: ["creative-version-1"],
  approved: true,
  killed: false,
};

describe("targeting and placement eligibility", () => {
  it("matches broad context without sensitive-trait targeting", () => {
    expect(targetMatches(target, context)).toBe(true);
    expect(
      targetMatches({ ...target, sensitiveTraits: ["medical_condition"] }, context),
    ).toBe(false);
  });

  it("suppresses sensitive story inventory even when a campaign opts in", () => {
    const result = evaluateEligibility({
      featureEnabled: true,
      globalKill: false,
      placementEnabled: true,
      minimumPublisherContentChars: 1_000,
      lineItem: {
        ...lineItem,
        target: { ...target, excludedSensitiveContent: false },
      },
      context: { ...context, sensitive: true },
      now: new Date("2026-07-24T12:00:00Z"),
      frequencyCapped: false,
      pacingAllowsDelivery: true,
    });
    expect(result).toEqual({ eligible: false, reason: "SENSITIVE_CONTENT" });
  });

  it("suppresses admin, preview, login, empty, and retracted surfaces", () => {
    for (const pageClass of [
      "ADMIN",
      "PREVIEW",
      "LOGIN",
      "EMPTY",
      "RETRACTED_STORY",
    ]) {
      expect(
        evaluateEligibility({
          featureEnabled: true,
          globalKill: false,
          placementEnabled: true,
          minimumPublisherContentChars: 0,
          lineItem,
          context: { ...context, pageClass },
          now: new Date("2026-07-24T12:00:00Z"),
          frequencyCapped: false,
          pacingAllowsDelivery: true,
        }).reason,
      ).toBe("PAGE_SUPPRESSED");
    }
  });

  it("requires schedule, approval, creative, cap, and pacing gates", () => {
    const eligible = evaluateEligibility({
      featureEnabled: true,
      globalKill: false,
      placementEnabled: true,
      minimumPublisherContentChars: 1_000,
      lineItem,
      context,
      now: new Date("2026-07-24T12:00:00Z"),
      frequencyCapped: false,
      pacingAllowsDelivery: true,
    });
    expect(eligible).toEqual({ eligible: true, reason: "ELIGIBLE" });
    expect(
      evaluateEligibility({
        featureEnabled: true,
        globalKill: false,
        placementEnabled: true,
        minimumPublisherContentChars: 1_000,
        lineItem,
        context,
        now: new Date("2026-07-24T12:00:00Z"),
        frequencyCapped: true,
        pacingAllowsDelivery: true,
      }).reason,
    ).toBe("FREQUENCY_CAPPED");
  });
});

