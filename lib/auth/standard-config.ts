import {
  isProductionAppEnvironment,
  resolveAppEnvironment,
} from "../newsletter/delivery";
import { resolveSiteOrigin } from "../newsletter/origin";

const MINIMUM_SECRET_LENGTH = 32;
const LOCAL_CSRF_SECRET =
  "northline-local-standard-auth-csrf-secret-not-for-production";
const LOCAL_RATE_LIMIT_SECRET =
  "northline-local-standard-auth-rate-limit-not-for-production";

export type StandardAuthEnvironment = {
  APP_ENV?: string;
  AUTH_ALLOW_REGISTRATION?: string;
  AUTH_MAGIC_LINK_ENABLED?: string;
  AUTH_MFA_PROVIDER?: string;
  AUTH_PROVIDER?: string;
  AUTH_SESSION_SECRET?: string;
  AUTH_STAFF_MFA_REQUIRED?: string;
  CSRF_SECRET?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  RATE_LIMIT_SECRET?: string;
};

export type StandardAuthConfiguration = {
  enabled: true;
  allowRegistration: boolean;
  origin: string;
  production: boolean;
  secureCookies: boolean;
  sessionSecret: string;
  csrfSecret: string;
  rateLimitSecret: string;
  staffMfaRequired: boolean;
  mfaProvider: string | null;
};

export class StandardAuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StandardAuthConfigurationError";
  }
}

export function resolveStandardAuthConfiguration(
  requestUrl: string,
  environment: StandardAuthEnvironment =
    process.env as StandardAuthEnvironment,
): StandardAuthConfiguration {
  const appEnvironment = resolveAppEnvironment(environment.APP_ENV);
  const production = isProductionAppEnvironment(appEnvironment);
  if (
    (environment.AUTH_PROVIDER?.trim().toLowerCase() || "standard") !==
      "standard" ||
    environment.AUTH_MAGIC_LINK_ENABLED !== "true"
  ) {
    throw new StandardAuthConfigurationError(
      "Standard magic-link authentication is disabled.",
    );
  }

  const sessionSecret = requiredSecret(
    environment.AUTH_SESSION_SECRET,
    "AUTH_SESSION_SECRET",
  );
  const csrfSecret = environment.CSRF_SECRET?.trim() || LOCAL_CSRF_SECRET;
  const rateLimitSecret =
    environment.RATE_LIMIT_SECRET?.trim() || LOCAL_RATE_LIMIT_SECRET;
  if (
    production &&
    (!environment.CSRF_SECRET?.trim() ||
      environment.CSRF_SECRET.trim().length < MINIMUM_SECRET_LENGTH)
  ) {
    throw new StandardAuthConfigurationError(
      "CSRF_SECRET must contain at least 32 characters in production.",
    );
  }
  if (
    production &&
    (!environment.RATE_LIMIT_SECRET?.trim() ||
      environment.RATE_LIMIT_SECRET.trim().length < MINIMUM_SECRET_LENGTH)
  ) {
    throw new StandardAuthConfigurationError(
      "RATE_LIMIT_SECRET must contain at least 32 characters in production.",
    );
  }

  const origin = resolveSiteOrigin({
    requestUrl,
    configuredOrigin: environment.NEXT_PUBLIC_SITE_URL,
    production,
  });
  return {
    enabled: true,
    allowRegistration: environment.AUTH_ALLOW_REGISTRATION === "true",
    origin,
    production,
    secureCookies: production || new URL(origin).protocol === "https:",
    sessionSecret,
    csrfSecret,
    rateLimitSecret,
    staffMfaRequired: environment.AUTH_STAFF_MFA_REQUIRED === "true",
    mfaProvider: normalizeProvider(environment.AUTH_MFA_PROVIDER),
  };
}

export type StaffMfaDecision =
  | { allowed: true; required: false }
  | {
      allowed: false;
      required: true;
      reason:
        | "policy_not_enabled"
        | "provider_unavailable"
        | "challenge_required";
    };

/**
 * Standard staff sessions never silently downgrade to a single factor.
 * A future MFA ceremony must pass `mfaVerified=true` before this gate opens.
 */
export function evaluateStaffMfaPolicy({
  isStaff,
  production,
  policyRequired,
  provider,
  mfaVerified,
}: {
  isStaff: boolean;
  production: boolean;
  policyRequired: boolean;
  provider: string | null;
  mfaVerified: boolean;
}): StaffMfaDecision {
  if (!isStaff) return { allowed: true, required: false };
  if (production && !policyRequired) {
    return {
      allowed: false,
      required: true,
      reason: "policy_not_enabled",
    };
  }
  if (!policyRequired) return { allowed: true, required: false };
  if (!provider) {
    return {
      allowed: false,
      required: true,
      reason: "provider_unavailable",
    };
  }
  return mfaVerified
    ? { allowed: true, required: false }
    : {
        allowed: false,
        required: true,
        reason: "challenge_required",
      };
}

export function safeStandardAuthRedirectPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 1_024) return "/";
  const normalized = value.replaceAll("\\", "/");
  if (!normalized.startsWith("/") || normalized.startsWith("//")) return "/";
  try {
    const url = new URL(normalized, "https://northline.invalid");
    if (
      url.origin !== "https://northline.invalid" ||
      url.pathname.startsWith("/api/auth/")
    ) {
      return "/";
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

function requiredSecret(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized || normalized.length < MINIMUM_SECRET_LENGTH) {
    throw new StandardAuthConfigurationError(
      `${name} must contain at least ${MINIMUM_SECRET_LENGTH} characters.`,
    );
  }
  return normalized;
}

function normalizeProvider(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^[a-z][a-z0-9_-]{1,31}$/.test(normalized)
    ? normalized
    : null;
}
