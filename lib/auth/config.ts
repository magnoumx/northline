export type AuthProvider = "standard" | "trusted_proxy" | "cloudflare_access";
export type TrustedProxyPlatform = "sites";

export type AuthEnvironment = {
  APP_ENV?: string;
  NODE_ENV?: string;
  AUTH_PROVIDER?: string;
  AUTH_SESSION_SECRET?: string;
  AUTH_TRUSTED_PROXY_MODE?: string;
  AUTH_TRUSTED_PROXY_PLATFORM?: string;
  AUTH_TRUSTED_PROXY_SECRET?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  CLOUDFLARE_ACCESS_ENABLED?: string;
  CLOUDFLARE_ACCESS_AUD?: string;
  CLOUDFLARE_ACCESS_TEAM_DOMAIN?: string;
};

export type AuthConfiguration =
  | {
      provider: "standard";
      trustedProxy: {
        enabled: boolean;
        platform: TrustedProxyPlatform | null;
        secret: string | null;
      };
      sessionSecret: string | null;
    }
  | {
      provider: "cloudflare_access";
      trustedProxy: {
        enabled: false;
        platform: null;
        secret: null;
      };
      sessionSecret: string | null;
      cloudflareAccess: {
        enabled: true;
        audience: string;
        teamDomain: string;
      };
    }
  | {
      provider: "trusted_proxy";
      trustedProxy: {
        enabled: true;
        platform: "sites";
        secret: string;
      };
      sessionSecret: string | null;
    };

const MINIMUM_SECRET_LENGTH = 32;

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

/**
 * Standard signed sessions are the default. The hosting-header adapter is only
 * enabled through three independent, server-controlled settings.
 */
export function resolveAuthConfiguration(
  environment: AuthEnvironment = process.env as AuthEnvironment,
): AuthConfiguration {
  const provider = normalizeProvider(environment.AUTH_PROVIDER);
  const trustedProxyMode = environment.AUTH_TRUSTED_PROXY_MODE === "true";
  const platform = normalizeTrustedProxyPlatform(
    environment.AUTH_TRUSTED_PROXY_PLATFORM,
  );
  const proxySecret = normalizeSecret(environment.AUTH_TRUSTED_PROXY_SECRET);
  const sessionSecret = normalizeSecret(environment.AUTH_SESSION_SECRET);
  const appEnvironment = (
    environment.APP_ENV ??
    environment.NODE_ENV ??
    "development"
  )
    .trim()
    .toLowerCase();

  if (
    appEnvironment === "production" &&
    (provider === "trusted_proxy" || trustedProxyMode)
  ) {
    throw new AuthConfigurationError(
      "Trusted proxy authentication is unavailable in production.",
    );
  }

  if (environment.AUTH_TRUSTED_PROXY_MODE === "true" && !platform) {
    throw new AuthConfigurationError(
      "Trusted proxy mode requires AUTH_TRUSTED_PROXY_PLATFORM=sites.",
    );
  }

  if (trustedProxyMode && !proxySecret) {
    throw new AuthConfigurationError(
      `AUTH_TRUSTED_PROXY_SECRET must contain at least ${MINIMUM_SECRET_LENGTH} characters.`,
    );
  }


  if (provider === "cloudflare_access") {
    if (environment.CLOUDFLARE_ACCESS_ENABLED !== "true") {
      throw new AuthConfigurationError(
        "cloudflare_access requires CLOUDFLARE_ACCESS_ENABLED=true.",
      );
    }
    const audience = environment.CLOUDFLARE_ACCESS_AUD?.trim();
    const teamDomain = environment.CLOUDFLARE_ACCESS_TEAM_DOMAIN?.trim();
    if (!audience || audience.length < 20) {
      throw new AuthConfigurationError(
        "CLOUDFLARE_ACCESS_AUD must contain the application audience tag.",
      );
    }
    if (!teamDomain || !teamDomain.includes("cloudflareaccess.com")) {
      throw new AuthConfigurationError(
        "CLOUDFLARE_ACCESS_TEAM_DOMAIN must contain the Zero Trust team domain.",
      );
    }
    return {
      provider,
      trustedProxy: { enabled: false, platform: null, secret: null },
      sessionSecret,
      cloudflareAccess: { enabled: true, audience, teamDomain },
    };
  }

  if (provider === "trusted_proxy") {
    if (!trustedProxyMode || platform !== "sites" || !proxySecret) {
      throw new AuthConfigurationError(
        "The trusted_proxy provider requires trusted proxy mode, the Sites platform, and a signing secret.",
      );
    }
    return {
      provider,
      trustedProxy: {
        enabled: true,
        platform,
        secret: proxySecret,
      },
      sessionSecret,
    };
  }

  return {
    provider: "standard",
    trustedProxy: {
      enabled: trustedProxyMode,
      platform,
      secret: proxySecret,
    },
    sessionSecret,
  };
}

export function requireStandardSessionSecret(
  configuration: AuthConfiguration,
): string {
  if (!configuration.sessionSecret) {
    throw new AuthConfigurationError(
      `AUTH_SESSION_SECRET must contain at least ${MINIMUM_SECRET_LENGTH} characters.`,
    );
  }
  return configuration.sessionSecret;
}

function normalizeProvider(value: string | undefined): AuthProvider {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "standard") return "standard";
  if (normalized === "trusted_proxy" || normalized === "cloudflare_access") return normalized;
  throw new AuthConfigurationError(`Unsupported AUTH_PROVIDER: ${normalized}.`);
}

function normalizeTrustedProxyPlatform(
  value: string | undefined,
): TrustedProxyPlatform | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  return normalized === "sites" ? normalized : null;
}

function normalizeSecret(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized && normalized.length >= MINIMUM_SECRET_LENGTH
    ? normalized
    : null;
}
