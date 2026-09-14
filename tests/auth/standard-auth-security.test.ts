import { describe, expect, it, vi } from "vitest";
import {
  createMagicLinkEmailSender,
  MagicLinkEmailConfigurationError,
} from "../../lib/auth/magic-link-email";
import {
  evaluateStaffMfaPolicy,
  resolveStandardAuthConfiguration,
  safeStandardAuthRedirectPath,
  StandardAuthConfigurationError,
} from "../../lib/auth/standard-config";
import {
  issueAuthCsrf,
  verifyAuthMutation,
} from "../../lib/auth/standard-csrf";

const productionEnvironment = {
  APP_ENV: "production",
  AUTH_PROVIDER: "standard",
  AUTH_MAGIC_LINK_ENABLED: "true",
  AUTH_SESSION_SECRET: "session-secret-with-at-least-thirty-two-characters",
  CSRF_SECRET: "csrf-secret-with-at-least-thirty-two-characters",
  RATE_LIMIT_SECRET: "rate-secret-with-at-least-thirty-two-characters",
  NEXT_PUBLIC_SITE_URL: "https://northline.example",
};

describe("standard authentication security boundaries", () => {
  it("requires explicit enablement and production secrets", () => {
    expect(() =>
      resolveStandardAuthConfiguration("https://northline.example", {
        ...productionEnvironment,
        AUTH_MAGIC_LINK_ENABLED: "false",
      }),
    ).toThrow(StandardAuthConfigurationError);
    expect(() =>
      resolveStandardAuthConfiguration("https://northline.example", {
        ...productionEnvironment,
        CSRF_SECRET: "short",
      }),
    ).toThrow("CSRF_SECRET");
    expect(
      resolveStandardAuthConfiguration(
        "https://northline.example/api/auth/csrf",
        productionEnvironment,
      ),
    ).toMatchObject({
      enabled: true,
      origin: "https://northline.example",
      production: true,
      secureCookies: true,
    });
  });

  it("binds CSRF proof to an HttpOnly same-site cookie and same origin", async () => {
    const issued = await issueAuthCsrf({
      secret: productionEnvironment.CSRF_SECRET,
      secure: true,
    });
    expect(issued.cookie).toContain("HttpOnly");
    expect(issued.cookie).toContain("SameSite=Strict");
    expect(issued.cookie).toContain("Secure");
    const cookie = issued.cookie.split(";", 1)[0];
    const request = new Request(
      "https://northline.example/api/auth/magic-link",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
          origin: "https://northline.example",
          "sec-fetch-site": "same-origin",
          "x-csrf-token": issued.token,
        },
        body: "{}",
      },
    );
    await expect(
      verifyAuthMutation(request, {
        origin: "https://northline.example",
        secret: productionEnvironment.CSRF_SECRET,
      }),
    ).resolves.toEqual({ allowed: true });

    const crossOrigin = new Request(request, {
      headers: new Headers({
        ...Object.fromEntries(request.headers),
        origin: "https://attacker.example",
      }),
    });
    await expect(
      verifyAuthMutation(crossOrigin, {
        origin: "https://northline.example",
        secret: productionEnvironment.CSRF_SECRET,
      }),
    ).resolves.toMatchObject({ allowed: false, reason: "origin" });
  });

  it("blocks unsafe redirect targets", () => {
    expect(safeStandardAuthRedirectPath("/latest?edition=us")).toBe(
      "/latest?edition=us",
    );
    expect(safeStandardAuthRedirectPath("//attacker.example")).toBe("/");
    expect(safeStandardAuthRedirectPath("/api/auth/sign-out")).toBe("/");
    expect(safeStandardAuthRedirectPath("https://attacker.example")).toBe("/");
  });

  it("makes staff MFA an enforceable production gate", () => {
    expect(
      evaluateStaffMfaPolicy({
        isStaff: true,
        production: true,
        policyRequired: false,
        provider: null,
        mfaVerified: false,
      }),
    ).toEqual({
      allowed: false,
      required: true,
      reason: "policy_not_enabled",
    });
    expect(
      evaluateStaffMfaPolicy({
        isStaff: true,
        production: true,
        policyRequired: true,
        provider: null,
        mfaVerified: false,
      }),
    ).toMatchObject({ allowed: false, reason: "provider_unavailable" });
    expect(
      evaluateStaffMfaPolicy({
        isStaff: true,
        production: true,
        policyRequired: true,
        provider: "totp",
        mfaVerified: true,
      }),
    ).toEqual({ allowed: true, required: false });
  });

  it("keeps email delivery disabled when unconfigured", async () => {
    expect(createMagicLinkEmailSender({})).toBeNull();
    expect(() =>
      createMagicLinkEmailSender({
        EMAIL_PROVIDER: "unsupported",
      }),
    ).toThrow(MagicLinkEmailConfigurationError);

    const fetchSpy = vi.fn<typeof fetch>(async () =>
      Response.json({ id: "email_123" }),
    );
    const sender = createMagicLinkEmailSender(
      {
        EMAIL_PROVIDER: "resend",
        EMAIL_API_KEY: "secret-api-key",
        EMAIL_FROM_ADDRESS: "security@northline.example",
        APP_NAME: "Northline",
      },
      fetchSpy,
    );
    await sender!.send({
      email: "reader@example.com",
      intent: "sign_in",
      magicLinkUrl:
        "https://northline.example/api/auth/magic-link/verify?token=secret",
      idempotencyKey: "auth-email-idempotency-key",
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({
      authorization: "Bearer secret-api-key",
      "idempotency-key": "auth-email-idempotency-key",
    });
  });
});
