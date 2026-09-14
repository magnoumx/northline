import { describe, expect, it } from "vitest";
import {
  INTERNAL_PROXY_HEADERS,
  TRUSTED_IDENTITY_HEADERS,
  verifyProxyAttestation,
} from "../../lib/auth/trusted-proxy";
import {
  hardenIncomingRequest,
  resolveAttestedClientAddress,
  runtimeAuthEnvironment,
} from "../../lib/security/request-trust";

const proxySecret =
  "trusted-proxy-test-secret-with-at-least-thirty-two-characters";

describe("trusted request boundary", () => {
  it("falls back safely when runtime bindings are absent", () => {
    expect(runtimeAuthEnvironment()).toEqual(
      expect.objectContaining({
        APP_ENV: process.env.APP_ENV,
        AUTH_PROVIDER: process.env.AUTH_PROVIDER,
      }),
    );
  });

  it("strips forged identity and forwarding headers by default", async () => {
    const request = new Request("https://northline.example/newsroom", {
      headers: {
        [TRUSTED_IDENTITY_HEADERS.email]: "owner@example.com",
        [INTERNAL_PROXY_HEADERS.attestation]: "forged",
        "cf-connecting-ip": "203.0.113.7",
        "x-forwarded-for": "198.51.100.4",
      },
    });
    const hardened = await hardenIncomingRequest(request, {});
    expect(hardened.headers.get(TRUSTED_IDENTITY_HEADERS.email)).toBeNull();
    expect(
      hardened.headers.get(INTERNAL_PROXY_HEADERS.attestation),
    ).toBeNull();
    expect(hardened.headers.get("cf-connecting-ip")).toBeNull();
    expect(hardened.headers.get("x-forwarded-for")).toBeNull();
  });

  it("attests Sites identity and client address only in explicit proxy mode", async () => {
    const request = new Request("https://northline.example/newsroom", {
      headers: {
        [TRUSTED_IDENTITY_HEADERS.email]: "OWNER@EXAMPLE.COM",
        [TRUSTED_IDENTITY_HEADERS.fullName]: "Ada%20Editor",
        [TRUSTED_IDENTITY_HEADERS.fullNameEncoding]:
          "percent-encoded-utf-8",
        "cf-connecting-ip": "8.8.8.8",
      },
    });
    Object.defineProperty(request, "cf", {
      value: { colo: "TEST" },
      configurable: true,
    });
    const environment = {
      AUTH_PROVIDER: "trusted_proxy",
      AUTH_TRUSTED_PROXY_MODE: "true",
      AUTH_TRUSTED_PROXY_PLATFORM: "sites",
      AUTH_TRUSTED_PROXY_SECRET: proxySecret,
      NEXT_PUBLIC_SITE_URL: "https://northline.example",
    };
    const hardened = await hardenIncomingRequest(request, environment);
    expect(hardened.headers.get(TRUSTED_IDENTITY_HEADERS.email)).toBe(
      "owner@example.com",
    );
    expect(
      await verifyProxyAttestation(hardened.headers, {
        secret: proxySecret,
      }),
    ).toBe(true);
    await expect(
      resolveAttestedClientAddress(hardened.headers, environment),
    ).resolves.toBe("8.8.8.8");

    const tampered = new Headers(hardened.headers);
    tampered.set(INTERNAL_PROXY_HEADERS.clientAddress, "1.1.1.1");
    await expect(
      resolveAttestedClientAddress(tampered, environment),
    ).resolves.toBe("unavailable");
  });
});


it("runtime auth environment includes Cloudflare Access bindings", () => {
  const environment = runtimeAuthEnvironment({
    AUTH_PROVIDER: "cloudflare_access",
    CLOUDFLARE_ACCESS_ENABLED: "true",
    CLOUDFLARE_ACCESS_AUD: "a".repeat(32),
    CLOUDFLARE_ACCESS_TEAM_DOMAIN: "usnorthline.cloudflareaccess.com",
  });
  expect(environment.CLOUDFLARE_ACCESS_ENABLED).toBe("true");
  expect(environment.CLOUDFLARE_ACCESS_AUD).toBe("a".repeat(32));
  expect(environment.CLOUDFLARE_ACCESS_TEAM_DOMAIN).toBe(
    "usnorthline.cloudflareaccess.com",
  );
});
