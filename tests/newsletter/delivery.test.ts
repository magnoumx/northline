import { describe, expect, it, vi } from "vitest";
import {
  assertEmailDeliveryConfigured,
  deliverNewsletterConfirmation,
  EmailDeliveryError,
  isProductionAppEnvironment,
  resolveAppEnvironment,
} from "../../lib/newsletter/delivery";
import {
  resolveSiteOrigin,
  SiteOriginConfigurationError,
} from "../../lib/newsletter/origin";

describe("newsletter delivery", () => {
  it("uses explicit APP_ENV promotion rather than build mode", () => {
    expect(isProductionAppEnvironment("production")).toBe(true);
    expect(isProductionAppEnvironment("preview")).toBe(false);
    expect(isProductionAppEnvironment(undefined)).toBe(false);
  });

  it("fails closed when production has no provider", () => {
    expect(() =>
      assertEmailDeliveryConfigured({ APP_ENV: "production" }),
    ).toThrow("EMAIL_PROVIDER");
  });

  it("fails closed when the deployment environment is missing or unknown", () => {
    expect(() => assertEmailDeliveryConfigured({})).toThrow("APP_ENV");
    expect(() =>
      assertEmailDeliveryConfigured({ APP_ENV: "prodution" }),
    ).toThrow("APP_ENV");
    expect(() => resolveAppEnvironment("PRODUCTION")).toThrow("APP_ENV");
    expect(() => resolveAppEnvironment(" production ")).toThrow("APP_ENV");
  });

  it("returns a clearly labeled preview only outside production", async () => {
    const result = await deliverNewsletterConfirmation({
      email: "reader@example.com",
      list: "daily-brief",
      confirmationUrl:
        "http://localhost:3000/newsletter/confirm?token=preview-token",
      idempotencyKey: "newsletter-confirmation-test",
      environment: { APP_ENV: "development" },
    });

    expect(result).toEqual({
      kind: "preview",
      confirmationUrl:
        "http://localhost:3000/newsletter/confirm?token=preview-token",
    });
  });

  it("sends through Resend with an idempotency key", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        void _input;
        void _init;
        return Response.json({ id: "email_123" }, { status: 200 });
      },
    );

    const result = await deliverNewsletterConfirmation({
      email: "reader@example.com",
      list: "daily-brief",
      confirmationUrl:
        "https://northline.example/newsletter/confirm?token=safe-token",
      idempotencyKey: "newsletter-confirmation-abc",
      environment: {
        APP_ENV: "production",
        EMAIL_PROVIDER: "resend",
        EMAIL_API_KEY: "test-api-key",
        EMAIL_FROM_ADDRESS: "Northline <briefings@northline.example>",
      },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(result).toEqual({
      kind: "sent",
      provider: "resend",
      providerId: "email_123",
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get("idempotency-key")).toBe(
      "newsletter-confirmation-abc",
    );
  });

  it("does not claim success when Resend rejects a request", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        void _input;
        void _init;
        return new Response(null, { status: 503 });
      },
    );

    await expect(
      deliverNewsletterConfirmation({
        email: "reader@example.com",
        list: "daily-brief",
        confirmationUrl:
          "https://northline.example/newsletter/confirm?token=safe-token",
        idempotencyKey: "newsletter-confirmation-abc",
        environment: {
          APP_ENV: "production",
          EMAIL_PROVIDER: "resend",
          EMAIL_API_KEY: "test-api-key",
          EMAIL_FROM_ADDRESS: "Northline <briefings@northline.example>",
        },
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(EmailDeliveryError);
  });
});

describe("newsletter confirmation origin", () => {
  it("uses the configured production origin, not the request host", () => {
    expect(
      resolveSiteOrigin({
        requestUrl: "https://attacker.example/api/newsletter",
        configuredOrigin: "https://northline.example/some-path",
        production: true,
      }),
    ).toBe("https://northline.example");
  });

  it("requires a configured HTTPS origin in production", () => {
    expect(() =>
      resolveSiteOrigin({
        requestUrl: "https://northline.example/api/newsletter",
        production: true,
      }),
    ).toThrow(SiteOriginConfigurationError);
    expect(() =>
      resolveSiteOrigin({
        requestUrl: "https://northline.example/api/newsletter",
        configuredOrigin: "http://northline.example",
        production: true,
      }),
    ).toThrow("HTTPS");
  });
});
