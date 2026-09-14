import { describe, expect, it } from "vitest";
import {
  AuthConfigurationError,
  resolveAuthConfiguration,
} from "../../lib/auth/config";

describe("authentication configuration", () => {
  it("defaults to signed standard sessions and no proxy trust", () => {
    expect(resolveAuthConfiguration({})).toEqual({
      provider: "standard",
      sessionSecret: null,
      trustedProxy: {
        enabled: false,
        platform: null,
        secret: null,
      },
    });
  });

  it("fails closed for an incomplete trusted proxy provider", () => {
    expect(() =>
      resolveAuthConfiguration({
        AUTH_PROVIDER: "trusted_proxy",
        AUTH_TRUSTED_PROXY_MODE: "false",
      }),
    ).toThrow(AuthConfigurationError);
    expect(() =>
      resolveAuthConfiguration({
        AUTH_PROVIDER: "trusted_proxy",
        AUTH_TRUSTED_PROXY_MODE: "true",
        AUTH_TRUSTED_PROXY_PLATFORM: "sites",
        AUTH_TRUSTED_PROXY_SECRET: "short",
      }),
    ).toThrow("AUTH_TRUSTED_PROXY_SECRET");
  });

  it("enables the Sites adapter only with every explicit control", () => {
    const configuration = resolveAuthConfiguration({
      APP_ENV: "preview",
      AUTH_PROVIDER: "trusted_proxy",
      AUTH_TRUSTED_PROXY_MODE: "true",
      AUTH_TRUSTED_PROXY_PLATFORM: "sites",
      AUTH_TRUSTED_PROXY_SECRET:
        "trusted-proxy-test-secret-with-at-least-32-characters",
    });
    expect(configuration.provider).toBe("trusted_proxy");
    expect(configuration.trustedProxy).toMatchObject({
      enabled: true,
      platform: "sites",
    });
  });

  it("enables Cloudflare Access as a production authentication provider", () => {
    const configuration = resolveAuthConfiguration({
      APP_ENV: "production",
      AUTH_PROVIDER: "cloudflare_access",
      CLOUDFLARE_ACCESS_ENABLED: "true",
      CLOUDFLARE_ACCESS_AUD: "audience-12345678901234567890",
      CLOUDFLARE_ACCESS_TEAM_DOMAIN: "northline.cloudflareaccess.com",
    });
    expect(configuration.provider).toBe("cloudflare_access");
    if (configuration.provider === "cloudflare_access") {
      expect(configuration.cloudflareAccess).toMatchObject({
        enabled: true,
        audience: "audience-12345678901234567890",
        teamDomain: "northline.cloudflareaccess.com",
      });
    }
  });

  it("rejects trusted proxy authentication in production", () => {
    const trustedProxy = {
      APP_ENV: "production",
      AUTH_PROVIDER: "trusted_proxy",
      AUTH_TRUSTED_PROXY_MODE: "true",
      AUTH_TRUSTED_PROXY_PLATFORM: "sites",
      AUTH_TRUSTED_PROXY_SECRET:
        "trusted-proxy-test-secret-with-at-least-32-characters",
    };

    expect(() => resolveAuthConfiguration(trustedProxy)).toThrow(
      "unavailable in production",
    );
    expect(() =>
      resolveAuthConfiguration({
        ...trustedProxy,
        AUTH_PROVIDER: "standard",
      }),
    ).toThrow("unavailable in production");
  });
});
