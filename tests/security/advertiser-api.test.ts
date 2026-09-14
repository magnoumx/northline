import { describe, expect, it } from "vitest";
import {
  advertiserPortalAvailable,
  createAdvertiserCsrfToken,
  protectAdvertiserMutation,
} from "../../lib/auth/advertiser-api";

const environment = {
  APP_ENV: "test",
  NEXT_PUBLIC_SITE_URL: "https://northline.example",
  CSRF_SECRET: "advertiser-csrf-test-secret-with-at-least-32-characters",
};

describe("authenticated advertiser mutation protection", () => {
  it("keeps the portal API disabled unless explicitly enabled", () => {
    expect(advertiserPortalAvailable({})).toBe(false);
    expect(
      advertiserPortalAvailable({ FEATURE_ADVERTISER_PORTAL: "true" }),
    ).toBe(true);
    expect(
      advertiserPortalAvailable({ FEATURE_ADVERTISER_PORTAL: "TRUE" }),
    ).toBe(false);
  });

  it("requires exact origin, JSON, and a user-bound CSRF token", async () => {
    const user = { userId: "user_advertiser_123" };
    const token = await createAdvertiserCsrfToken(
      user,
      new Request("https://northline.example/api/advertiser/csrf"),
      environment,
    );
    const mutationRequest = (
      origin = "https://northline.example",
      fetchSite = "same-origin",
    ) =>
      new Request("https://northline.example/api/advertiser/campaigns", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin,
          "sec-fetch-site": fetchSite,
          "x-csrf-token": token,
        },
        body: "{}",
      });
    await expect(
      protectAdvertiserMutation(mutationRequest(), user, environment),
    ).resolves.toEqual({ allowed: true });

    await expect(
      protectAdvertiserMutation(
        mutationRequest("https://attacker.example", "cross-site"),
        user,
        environment,
      ),
    ).resolves.toMatchObject({
      allowed: false,
      status: 403,
      reason: "origin",
    });

    await expect(
      protectAdvertiserMutation(
        mutationRequest(),
        { userId: "user_other_12345" },
        environment,
      ),
    ).resolves.toMatchObject({
      allowed: false,
      status: 403,
      reason: "csrf",
    });
  });

  it("fails closed when production has no strong CSRF secret", async () => {
    const request = new Request(
      "https://northline.example/api/advertiser/organizations",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://northline.example",
        },
        body: "{}",
      },
    );
    await expect(
      protectAdvertiserMutation(
        request,
        { userId: "user_advertiser_123" },
        {
          APP_ENV: "production",
          NEXT_PUBLIC_SITE_URL: "https://northline.example",
          CSRF_SECRET: "short",
        },
      ),
    ).resolves.toEqual({
      allowed: false,
      status: 503,
      reason: "configuration",
    });
  });
});
