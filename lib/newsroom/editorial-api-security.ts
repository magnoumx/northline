import type { ChatGPTUser } from "../../app/chatgpt-auth";
import { getChatGPTUser } from "../../app/chatgpt-auth";
import type { Permission } from "../auth/permissions";
import { authorizeStaffIdentity } from "../auth/rbac";
import { createCsrfToken, verifyCsrfToken } from "../security/csrf";
import { validateMutationRequest } from "../security/origin";
import { resolveSiteOrigin } from "../newsletter/origin";
import { apiErrorResponse } from "../security/api";

const LOCAL_CSRF_SECRET =
  "northline-local-editorial-api-csrf-secret-not-for-production";

export type EditorialAccess =
  | {
      allowed: true;
      user: ChatGPTUser;
      /** Effective grants, so a route can scope reads to owned records. */
      permissions: readonly Permission[];
    }
  | { allowed: false; response: Response };

export function editorialWritesAvailable(): boolean {
  return process.env.FEATURE_EDITORIAL_WRITES === "true";
}

export async function authorizeEditorialRequest(
  required: readonly Permission[],
): Promise<EditorialAccess> {
  if (!editorialWritesAvailable()) {
    return {
      allowed: false,
      response: apiErrorResponse("NOT_FOUND", {
        status: 404,
        message: "Editorial writes are not enabled.",
      }),
    };
  }
  const user = await getChatGPTUser();
  if (!user) {
    return {
      allowed: false,
      response: apiErrorResponse("UNAUTHORIZED", {
        status: 401,
        message: "Authentication is required.",
        headers: { "www-authenticate": "Session" },
      }),
    };
  }
  const authorization = await authorizeStaffIdentity(user, required);
  if (!authorization.allowed) {
    return {
      allowed: false,
      response: apiErrorResponse("FORBIDDEN", {
        status: 403,
        message: "The newsroom role cannot perform this operation.",
      }),
    };
  }
  return {
    allowed: true,
    user: {
      ...user,
      // Cloudflare Access and trusted-proxy subjects are external identity ids.
      // Editorial foreign keys and audit records must use the authoritative D1
      // principal resolved by RBAC.
      userId: authorization.principal.userId,
    },
    permissions: authorization.permissions,
  };
}

export async function issueEditorialCsrf(
  user: Pick<ChatGPTUser, "userId">,
): Promise<string> {
  return createCsrfToken({
    secret: csrfSecret(),
    subject: editorialCsrfSubject(user.userId),
    ttlSeconds: 30 * 60,
  });
}

export async function protectEditorialMutation(
  request: Request,
  user: Pick<ChatGPTUser, "userId">,
  options: { allowedMediaTypes?: readonly string[] } = {},
): Promise<{ allowed: true } | { allowed: false; response: Response }> {
  let origin: string;
  let secret: string;
  try {
    origin = resolveSiteOrigin({
      requestUrl: request.url,
      configuredOrigin: process.env.NEXT_PUBLIC_SITE_URL,
      production: process.env.APP_ENV === "production",
    });
    secret = csrfSecret();
  } catch {
    return {
      allowed: false,
      response: apiErrorResponse("UNAVAILABLE", {
        status: 503,
        message: "Editorial request security is unavailable.",
      }),
    };
  }
  const validation = validateMutationRequest(request, {
    allowedOrigins: [origin],
    allowedMediaTypes: options.allowedMediaTypes ?? ["application/json"],
    requireOrigin: true,
  });
  if (!validation.allowed) {
    return {
      allowed: false,
      response: apiErrorResponse(
        validation.status === 415 ? "UNSUPPORTED_MEDIA_TYPE" : "FORBIDDEN",
        {
          status: validation.status,
          message: "The editorial request could not be verified.",
        },
      ),
    };
  }
  const csrf = await verifyCsrfToken(
    request.headers.get("x-csrf-token") ?? "",
    {
      secret,
      subject: editorialCsrfSubject(user.userId),
    },
  );
  return csrf.valid
    ? { allowed: true }
    : {
        allowed: false,
        response: apiErrorResponse("FORBIDDEN", {
          status: 403,
          message: "The editorial request could not be verified.",
        }),
      };
}

function csrfSecret(): string {
  const configured = process.env.CSRF_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (process.env.APP_ENV === "production") {
    throw new Error("CSRF_SECRET is required in production.");
  }
  return LOCAL_CSRF_SECRET;
}

function editorialCsrfSubject(userId: string): string {
  return `editorial-api:${userId}`;
}
