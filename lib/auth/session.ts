import {
  decodeBase64UrlText,
  encodeBase64UrlText,
  hmacSha256Base64Url,
  verifyHmacSha256Base64Url,
} from "../security/crypto";

export const SESSION_COOKIE_NAME = "northline_session";
const SESSION_TOKEN_VERSION = "nl1";
const MINIMUM_SECRET_LENGTH = 32;
const MAXIMUM_SESSION_SECONDS = 30 * 24 * 60 * 60;
const CLOCK_SKEW_SECONDS = 30;

export type SessionClaims = {
  version: 1;
  sessionId: string;
  userId: string;
  email: string;
  displayName: string;
  issuedAt: number;
  expiresAt: number;
  rotateAfter: number;
  authVersion: number;
};

export type SessionState = {
  sessionId: string;
  userId: string;
  authVersion: number;
  expiresAt: number;
  revokedAt: number | null;
};

export interface SessionStateReader {
  readSessionState(sessionId: string): Promise<SessionState | null>;
}

export interface SessionStateWriter extends SessionStateReader {
  rotateSession(
    previousSessionId: string,
    next: SessionState,
    rotatedAt: number,
  ): Promise<boolean>;
  revokeSession(sessionId: string, revokedAt: number, reason: string): Promise<void>;
}

export type SessionVerification =
  | {
      valid: true;
      claims: SessionClaims;
      needsRotation: boolean;
      stateChecked: boolean;
    }
  | {
      valid: false;
      reason:
        | "malformed"
        | "bad_signature"
        | "not_yet_valid"
        | "expired"
        | "invalid_claims"
        | "revoked"
        | "stale"
        | "unknown_session";
    };

export type IssueSessionInput = {
  sessionId?: string;
  userId: string;
  email: string;
  displayName?: string | null;
  authVersion?: number;
  now?: Date;
  ttlSeconds?: number;
  rotationSeconds?: number;
};

export async function issueSessionToken(
  input: IssueSessionInput,
  secret: string,
): Promise<{ token: string; claims: SessionClaims }> {
  assertSessionSecret(secret);
  const issuedAt = unixSeconds(input.now ?? new Date());
  const ttlSeconds = boundedDuration(
    input.ttlSeconds ?? 8 * 60 * 60,
    5 * 60,
    MAXIMUM_SESSION_SECONDS,
    "ttlSeconds",
  );
  const rotationSeconds = boundedDuration(
    input.rotationSeconds ?? 60 * 60,
    60,
    ttlSeconds,
    "rotationSeconds",
  );
  const claims: SessionClaims = {
    version: 1,
    sessionId: input.sessionId ?? crypto.randomUUID(),
    userId: input.userId,
    email: input.email.trim().toLowerCase(),
    displayName: input.displayName?.trim() || input.email.trim().toLowerCase(),
    issuedAt,
    expiresAt: issuedAt + ttlSeconds,
    rotateAfter: issuedAt + rotationSeconds,
    authVersion: input.authVersion ?? 1,
  };
  if (!isSessionClaims(claims)) {
    throw new TypeError("Session input contains invalid claims.");
  }

  const encodedClaims = encodeBase64UrlText(JSON.stringify(claims));
  const unsigned = `${SESSION_TOKEN_VERSION}.${encodedClaims}`;
  const signature = await hmacSha256Base64Url(secret, unsigned);
  return { token: `${unsigned}.${signature}`, claims };
}

export async function verifySessionToken(
  token: string,
  {
    secret,
    now = new Date(),
    stateReader,
  }: {
    secret: string;
    now?: Date;
    stateReader?: SessionStateReader;
  },
): Promise<SessionVerification> {
  if (secret.trim().length < MINIMUM_SECRET_LENGTH) {
    return { valid: false, reason: "bad_signature" };
  }
  const parts = token.split(".");
  if (
    parts.length !== 3 ||
    parts[0] !== SESSION_TOKEN_VERSION ||
    parts.some((part) => !part)
  ) {
    return { valid: false, reason: "malformed" };
  }

  const unsigned = `${parts[0]}.${parts[1]}`;
  if (!(await verifyHmacSha256Base64Url(secret, unsigned, parts[2]))) {
    return { valid: false, reason: "bad_signature" };
  }

  const serialized = decodeBase64UrlText(parts[1]);
  if (!serialized) return { valid: false, reason: "malformed" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    return { valid: false, reason: "malformed" };
  }
  if (!isSessionClaims(parsed)) {
    return { valid: false, reason: "invalid_claims" };
  }

  const nowSeconds = unixSeconds(now);
  if (parsed.issuedAt > nowSeconds + CLOCK_SKEW_SECONDS) {
    return { valid: false, reason: "not_yet_valid" };
  }
  if (parsed.expiresAt <= nowSeconds) {
    return { valid: false, reason: "expired" };
  }
  if (
    parsed.expiresAt - parsed.issuedAt > MAXIMUM_SESSION_SECONDS ||
    parsed.rotateAfter < parsed.issuedAt ||
    parsed.rotateAfter > parsed.expiresAt
  ) {
    return { valid: false, reason: "invalid_claims" };
  }

  if (stateReader) {
    const state = await stateReader.readSessionState(parsed.sessionId);
    if (!state) return { valid: false, reason: "unknown_session" };
    if (state.revokedAt !== null) return { valid: false, reason: "revoked" };
    if (
      state.userId !== parsed.userId ||
      state.authVersion !== parsed.authVersion ||
      state.expiresAt !== parsed.expiresAt
    ) {
      return { valid: false, reason: "stale" };
    }
  }

  return {
    valid: true,
    claims: parsed,
    needsRotation: parsed.rotateAfter <= nowSeconds,
    stateChecked: Boolean(stateReader),
  };
}

/**
 * Creates a replacement token; the caller must persist the replacement and
 * revoke the previous session atomically through SessionStateWriter.
 */
export async function createRotatedSessionToken(
  verification: Extract<SessionVerification, { valid: true }>,
  {
    secret,
    now = new Date(),
    ttlSeconds,
    rotationSeconds,
  }: {
    secret: string;
    now?: Date;
    ttlSeconds?: number;
    rotationSeconds?: number;
  },
): Promise<{
  previousSessionId: string;
  token: string;
  claims: SessionClaims;
  state: SessionState;
}> {
  const issued = await issueSessionToken(
    {
      userId: verification.claims.userId,
      email: verification.claims.email,
      displayName: verification.claims.displayName,
      authVersion: verification.claims.authVersion,
      now,
      ttlSeconds,
      rotationSeconds,
    },
    secret,
  );
  return {
    previousSessionId: verification.claims.sessionId,
    ...issued,
    state: sessionStateFromClaims(issued.claims),
  };
}

export function sessionStateFromClaims(claims: SessionClaims): SessionState {
  return {
    sessionId: claims.sessionId,
    userId: claims.userId,
    authVersion: claims.authVersion,
    expiresAt: claims.expiresAt,
    revokedAt: null,
  };
}

export function readSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 1) continue;
    const name = entry.slice(0, separator).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    const value = entry.slice(separator + 1).trim();
    return /^[A-Za-z0-9._-]{40,4096}$/.test(value) ? value : null;
  }
  return null;
}

export function serializeSessionCookie(
  token: string,
  {
    maxAgeSeconds,
    secure = true,
  }: {
    maxAgeSeconds: number;
    secure?: boolean;
  },
): string {
  if (!/^[A-Za-z0-9._-]{40,4096}$/.test(token)) {
    throw new TypeError("Session token contains invalid cookie characters.");
  }
  const maxAge = boundedDuration(
    maxAgeSeconds,
    1,
    MAXIMUM_SESSION_SECONDS,
    "maxAgeSeconds",
  );
  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    `Max-Age=${maxAge}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearSessionCookie({ secure = true } = {}): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    "Max-Age=0",
  ]
    .filter(Boolean)
    .join("; ");
}

function isSessionClaims(value: unknown): value is SessionClaims {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const claims = value as Partial<SessionClaims>;
  return (
    claims.version === 1 &&
    isOpaqueId(claims.sessionId) &&
    isOpaqueId(claims.userId) &&
    typeof claims.email === "string" &&
    isEmail(claims.email) &&
    typeof claims.displayName === "string" &&
    claims.displayName.length >= 1 &&
    claims.displayName.length <= 160 &&
    !CONTROL_CHARACTERS.test(claims.displayName) &&
    isTimestamp(claims.issuedAt) &&
    isTimestamp(claims.expiresAt) &&
    isTimestamp(claims.rotateAfter) &&
    Number.isSafeInteger(claims.authVersion) &&
    (claims.authVersion ?? 0) >= 1
  );
}

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

function isOpaqueId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 8 &&
    value.length <= 128 &&
    /^[A-Za-z0-9:_-]+$/.test(value)
  );
}

function isEmail(value: string): boolean {
  return (
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) &&
    !CONTROL_CHARACTERS.test(value)
  );
}

function isTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function unixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1_000);
}

function assertSessionSecret(secret: string): void {
  if (secret.trim().length < MINIMUM_SECRET_LENGTH) {
    throw new TypeError(
      `Session signing secret must contain at least ${MINIMUM_SECRET_LENGTH} characters.`,
    );
  }
}

function boundedDuration(
  value: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be between ${minimum} and ${maximum}.`);
  }
  return value;
}
