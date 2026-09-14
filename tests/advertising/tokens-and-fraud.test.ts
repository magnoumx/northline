import { describe, expect, it } from "vitest";
import {
  signAdToken,
  verifyAdToken,
} from "../../lib/advertising/tokens";
import { classifyTraffic } from "../../lib/advertising/fraud";
import { reconcileBillingEvents } from "../../lib/advertising/delivery";
import { validateAdvertiserDestination } from "../../lib/advertising/destinations";

const secret = "a-production-shaped-test-secret-with-32-bytes";

function payload(purpose: "IMPRESSION" | "VIEWABILITY" | "CLICK") {
  return {
    purpose,
    jti: `nonce-${purpose}`,
    iat: 1_000,
    exp: 1_300,
    requestId: "request-1",
    campaignId: "campaign-1",
    lineItemId: "line-1",
    creativeVersionId: "creative-version-1",
    ...(purpose === "CLICK"
      ? { destination: "https://advertiser.example/landing" }
      : {}),
  } as const;
}

describe("signed advertising events", () => {
  it("round-trips purpose-bound impression and click tokens", async () => {
    for (const purpose of ["IMPRESSION", "CLICK"] as const) {
      const token = await signAdToken(payload(purpose), secret);
      const result = await verifyAdToken(token, secret, purpose, 1_100);
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.payload.purpose).toBe(purpose);
    }
  });

  it("rejects tampering, cross-purpose use, and expiry", async () => {
    const token = await signAdToken(payload("CLICK"), secret);
    const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
    expect((await verifyAdToken(tampered, secret, "CLICK", 1_100)).valid).toBe(
      false,
    );
    expect(
      await verifyAdToken(token, secret, "IMPRESSION", 1_100),
    ).toMatchObject({ valid: false, reason: "WRONG_PURPOSE" });
    expect(await verifyAdToken(token, secret, "CLICK", 1_301)).toMatchObject({
      valid: false,
      reason: "EXPIRED",
    });
  });

  it("deduplicates validated events and excludes invalid activity from billing", () => {
    const result = reconcileBillingEvents({
      rawEventIds: ["a", "b", "c"],
      validatedEventIds: ["a", "a", "b", "outside"],
      invalidEventIds: ["b"],
    });
    expect(result.rawEvents).toBe(3);
    expect(result.validatedEvents).toBe(2);
    expect(result.billableEventIds).toEqual(["a"]);
    expect(result.duplicateIds).toEqual(["a"]);
  });

  it("prevents open redirects and reserved advertising destinations", () => {
    expect(
      validateAdvertiserDestination("https://advertiser.com/offer", [
        "advertiser.com",
      ]).valid,
    ).toBe(true);
    expect(
      validateAdvertiserDestination("https://evil.com/offer", [
        "advertiser.com",
      ]),
    ).toEqual({ valid: false, reason: "NOT_APPROVED" });
    expect(
      validateAdvertiserDestination("https://127.0.0.1/admin"),
    ).toEqual({ valid: false, reason: "RESERVED_HOST" });
    expect(validateAdvertiserDestination("javascript:alert(1)")).toEqual({
      valid: false,
      reason: "INVALID_URL",
    });
  });
});

describe("invalid traffic", () => {
  it("excludes crawlers, admin traffic, replay, and impossible volume", () => {
    expect(
      classifyTraffic({
        userAgent: "Googlebot",
        isInternalAddress: false,
        isAdminSession: false,
        eventsForToken: 1,
        requestsForAddressInMinute: 1,
        impressions: 1,
        clicks: 0,
        dataCenterAddress: false,
      }).classification,
    ).toBe("CRAWLER");

    const replay = classifyTraffic({
      userAgent: "Mozilla/5.0",
      isInternalAddress: false,
      isAdminSession: false,
      eventsForToken: 2,
      requestsForAddressInMinute: 150,
      impressions: 30,
      clicks: 20,
      dataCenterAddress: true,
    });
    expect(replay.excluded).toBe(true);
    expect(replay.reasons).toContain("TOKEN_REPLAY");
    expect(replay.reasons).toContain("IMPOSSIBLE_VOLUME");
  });
});
