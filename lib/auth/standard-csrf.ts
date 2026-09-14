import { createCsrfToken, verifyCsrfToken } from "../security/csrf";
import { randomBase64Url } from "../security/crypto";
import { validateMutationRequest } from "../security/origin";

export const AUTH_CSRF_COOKIE_NAME = "northline_auth_csrf";
const MAXIMUM_CSRF_COOKIE_AGE = 30 * 60;

export function serializeAuthCsrfCookie(
  nonce: string,
  { secure }: { secure: boolean },
): string {
  if (!/^[A-Za-z0-9_-]{32}$/.test(nonce)) {
    throw new TypeError("Authentication CSRF nonce is invalid.");
  }
  return [
    `${AUTH_CSRF_COOKIE_NAME}=${nonce}`,
    "Path=/api/auth",
    "HttpOnly",
    "SameSite=Strict",
    secure ? "Secure" : "",
    `Max-Age=${MAXIMUM_CSRF_COOKIE_AGE}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export async function issueAuthCsrf({
  secret,
  secure,
}: {
  secret: string;
  secure: boolean;
}): Promise<{ token: string; cookie: string }> {
  const nonce = randomBase64Url(24);
  return {
    token: await createCsrfToken({
      secret,
      subject: csrfSubject(nonce),
      ttlSeconds: MAXIMUM_CSRF_COOKIE_AGE,
    }),
    cookie: serializeAuthCsrfCookie(nonce, { secure }),
  };
}

export async function verifyAuthMutation(
  request: Request,
  {
    origin,
    secret,
  }: {
    origin: string;
    secret: string;
  },
): Promise<
  | { allowed: true }
  | {
      allowed: false;
      reason: "origin" | "media_type" | "csrf";
      status: 403 | 415;
    }
> {
  const requestProtection = validateMutationRequest(request, {
    allowedOrigins: [origin],
    allowedMediaTypes: ["application/json"],
    requireOrigin: true,
  });
  if (!requestProtection.allowed) {
    return {
      allowed: false,
      reason:
        requestProtection.status === 415 ? "media_type" : "origin",
      status: requestProtection.status,
    };
  }
  const nonce = readAuthCsrfCookie(request.headers.get("cookie"));
  const token = request.headers.get("x-csrf-token")?.trim() ?? "";
  if (!nonce || !token) {
    return { allowed: false, reason: "csrf", status: 403 };
  }
  const verification = await verifyCsrfToken(token, {
    secret,
    subject: csrfSubject(nonce),
  });
  return verification.valid
    ? { allowed: true }
    : { allowed: false, reason: "csrf", status: 403 };
}

export function readAuthCsrfCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 1) continue;
    if (
      entry.slice(0, separator).trim() !== AUTH_CSRF_COOKIE_NAME
    ) {
      continue;
    }
    const value = entry.slice(separator + 1).trim();
    return /^[A-Za-z0-9_-]{32}$/.test(value) ? value : null;
  }
  return null;
}

function csrfSubject(nonce: string): string {
  return `standard-auth-api:${nonce}`;
}
