import type { ChatGPTUser } from "../../app/chatgpt-auth";
import { getDb } from "../../db";
import { apiErrorResponse } from "../security/api";
import {
  createCsrfToken,
  verifyCsrfToken,
} from "../security/csrf";
import {
  validateMutationRequest,
} from "../security/origin";
import {
  isProductionAppEnvironment,
  resolveAppEnvironment,
} from "../newsletter/delivery";
import { resolveSiteOrigin } from "../newsletter/origin";
import {
  createD1AdvertiserTenantStore,
  type AdvertiserServiceResult,
} from "./advertiser-tenant";
import { createD1RbacRepository } from "./rbac";

const LOCAL_ADVERTISER_CSRF_SECRET =
  "northline-local-advertiser-csrf-key-not-for-production";

export type AdvertiserApiEnvironment = {
  APP_ENV?: string;
  CSRF_SECRET?: string;
  FEATURE_ADVERTISER_PORTAL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
};

export type AdvertiserMutationProtection =
  | { allowed: true }
  | {
      allowed: false;
      status: 403 | 415 | 503;
      reason: "origin" | "media_type" | "csrf" | "configuration";
    };

export async function createAdvertiserApiDependencies() {
  const db = await getDb();
  return {
    rbac: createD1RbacRepository(db),
    store: createD1AdvertiserTenantStore(db),
  };
}

export function advertiserAuthenticationRequired(): Response {
  return apiErrorResponse("UNAUTHORIZED", {
    status: 401,
    message: "Authentication is required.",
    headers: { "www-authenticate": "Session" },
  });
}

export function advertiserPortalAvailable(
  environment: AdvertiserApiEnvironment =
    process.env as AdvertiserApiEnvironment,
): boolean {
  return environment.FEATURE_ADVERTISER_PORTAL === "true";
}

export function advertiserPortalUnavailable(): Response {
  return apiErrorResponse("NOT_FOUND", {
    status: 404,
    message: "The advertiser portal is not available.",
  });
}

export function advertiserServiceError(
  result: Extract<AdvertiserServiceResult<unknown>, { ok: false }>,
): Response {
  if (result.reason === "not_found") {
    return apiErrorResponse("NOT_FOUND", {
      status: 404,
      message: "The requested resource was not found.",
    });
  }
  if (result.reason === "idempotency_conflict") {
    return apiErrorResponse("CONFLICT", {
      status: 409,
      message: "The idempotency key was already used for another request.",
    });
  }
  if (result.reason === "forbidden") {
    return apiErrorResponse("FORBIDDEN", {
      status: 403,
      message: "This account is not authorized for that operation.",
    });
  }
  return apiErrorResponse("UNAVAILABLE", {
    status: 503,
    message: "Advertiser account storage is temporarily unavailable.",
  });
}

export function advertiserMutationError(
  protection: Extract<AdvertiserMutationProtection, { allowed: false }>,
): Response {
  return apiErrorResponse(
    protection.status === 415
      ? "UNSUPPORTED_MEDIA_TYPE"
      : protection.status === 503
        ? "UNAVAILABLE"
        : "FORBIDDEN",
    {
      status: protection.status,
      message:
        protection.reason === "media_type"
          ? "Send the request as JSON."
          : protection.reason === "configuration"
            ? "Advertiser request security is temporarily unavailable."
            : "The advertiser request could not be verified.",
    },
  );
}

export function resolveAdvertiserApiSecurity(
  request: Request,
  environment: AdvertiserApiEnvironment =
    process.env as AdvertiserApiEnvironment,
): { origin: string; csrfSecret: string } {
  const appEnvironment = resolveAppEnvironment(environment.APP_ENV);
  const production = isProductionAppEnvironment(appEnvironment);
  const origin = resolveSiteOrigin({
    requestUrl: request.url,
    configuredOrigin: environment.NEXT_PUBLIC_SITE_URL,
    production,
  });
  const configuredSecret = environment.CSRF_SECRET?.trim();
  if (configuredSecret && configuredSecret.length >= 32) {
    return { origin, csrfSecret: configuredSecret };
  }
  if (production) {
    throw new Error(
      "CSRF_SECRET must contain at least 32 characters in production.",
    );
  }
  return { origin, csrfSecret: LOCAL_ADVERTISER_CSRF_SECRET };
}

export async function createAdvertiserCsrfToken(
  user: Pick<ChatGPTUser, "userId">,
  request: Request,
  environment?: AdvertiserApiEnvironment,
): Promise<string> {
  const { csrfSecret } = resolveAdvertiserApiSecurity(request, environment);
  return createCsrfToken({
    secret: csrfSecret,
    subject: advertiserCsrfSubject(user),
    ttlSeconds: 30 * 60,
  });
}

export async function protectAdvertiserMutation(
  request: Request,
  user: Pick<ChatGPTUser, "userId">,
  environment?: AdvertiserApiEnvironment,
): Promise<AdvertiserMutationProtection> {
  let security: ReturnType<typeof resolveAdvertiserApiSecurity>;
  try {
    security = resolveAdvertiserApiSecurity(request, environment);
  } catch {
    return {
      allowed: false,
      status: 503,
      reason: "configuration",
    };
  }
  const requestProtection = validateMutationRequest(request, {
    allowedOrigins: [security.origin],
    allowedMediaTypes: ["application/json"],
    requireOrigin: true,
  });
  if (!requestProtection.allowed) {
    return {
      allowed: false,
      status: requestProtection.status,
      reason:
        requestProtection.status === 415 ? "media_type" : "origin",
    };
  }
  const token = request.headers.get("x-csrf-token")?.trim() ?? "";
  const verification = await verifyCsrfToken(token, {
    secret: security.csrfSecret,
    subject: advertiserCsrfSubject(user),
  });
  return verification.valid
    ? { allowed: true }
    : { allowed: false, status: 403, reason: "csrf" };
}

function advertiserCsrfSubject(
  user: Pick<ChatGPTUser, "userId">,
): string {
  return `advertiser-api:${user.userId}`;
}
