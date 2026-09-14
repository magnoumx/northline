import { runtimeFetch } from "../runtime/fetch";
const CLOCK_SKEW_SECONDS = 30;
const JWKS_CACHE_MS = 5 * 60 * 1000;
export const INTERNAL_ACCESS_JWT_HEADER = "x-northline-verified-access-jwt";
export const INTERNAL_ACCESS_JWT_COOKIE = "northline_verified_access_jwt";

export type CloudflareAccessEnvironment = {
  CLOUDFLARE_ACCESS_AUD?: string;
  CLOUDFLARE_ACCESS_TEAM_DOMAIN?: string;
};

export type CloudflareAccessIdentity = {
  subject: string;
  email: string;
  name: string | null;
  issuedAt: number;
  expiresAt: number;
  authenticationMethods: readonly string[];
};

type JwtHeader = {
  alg?: unknown;
  kid?: unknown;
  typ?: unknown;
};

type JwtPayload = {
  aud?: unknown;
  email?: unknown;
  exp?: unknown;
  iat?: unknown;
  iss?: unknown;
  name?: unknown;
  nbf?: unknown;
  sub?: unknown;
  amr?: unknown;
};

type AccessJsonWebKey = JsonWebKey & {
  kid?: string;
  alg?: string;
  use?: string;
};

type JsonWebKeySet = {
  keys?: AccessJsonWebKey[];
};

type CachedJwks = {
  expiresAt: number;
  keys: AccessJsonWebKey[];
};

const jwksCache = new Map<string, CachedJwks>();

export class CloudflareAccessVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudflareAccessVerificationError";
  }
}

export async function verifyCloudflareAccessRequest(
  requestHeaders: Headers,
  {
    environment = process.env as CloudflareAccessEnvironment,
    fetchImpl = runtimeFetch,
    now = new Date(),
  }: {
    environment?: CloudflareAccessEnvironment;
    fetchImpl?: typeof fetch;
    now?: Date;
  } = {},
): Promise<CloudflareAccessIdentity | null> {
  const audience = normalizeAudience(environment.CLOUDFLARE_ACCESS_AUD);
  const teamOrigin = normalizeTeamOrigin(
    environment.CLOUDFLARE_ACCESS_TEAM_DOMAIN,
  );
  // Every failure below used to return null identically, so a locked-out
  // operator and a misconfigured audience produced the same blank sign-in
  // loop. The reason is now stated. No token, claim, or secret is logged -
  // only which check refused, and the audience is reduced to a short prefix so
  // a mismatch is comparable against the dashboard without exposing it.
  if (!audience || !teamOrigin) {
    console.warn("cloudflare_access_not_configured", {
      hasAudience: Boolean(audience),
      hasTeamOrigin: Boolean(teamOrigin),
    });
    return null;
  }

  const token = readCloudflareAccessToken(requestHeaders);
  if (!token) {
    console.warn("cloudflare_access_token_absent", {
      hasAssertionHeader: Boolean(requestHeaders.get("cf-access-jwt-assertion")),
      hasCookieHeader: Boolean(requestHeaders.get("cookie")),
    });
    return null;
  }

  try {
    return await verifyCloudflareAccessJwt(token, {
      audience,
      teamOrigin,
      fetchImpl,
      now,
    });
  } catch (error) {
    console.warn("cloudflare_access_token_rejected", {
      audiencePrefix: audience.slice(0, 8),
      teamOrigin,
      message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
    });
    return null;
  }
}

export function readCloudflareAccessToken(
  requestHeaders: Headers,
  { allowInternalBridge = true }: { allowInternalBridge?: boolean } = {},
): string | null {
  if (allowInternalBridge) {
    const bridged = requestHeaders.get(INTERNAL_ACCESS_JWT_HEADER)?.trim();
    if (bridged) return bridged;
  }

  const assertion = requestHeaders.get("cf-access-jwt-assertion")?.trim();
  if (assertion) return assertion;

  // The raw Worker boundary can copy a successfully verified Access JWT into
  // a request-only cookie before vinext reconstructs the framework request.
  // This cookie is never trusted on its own: the JWT is verified again below.
  const bridgedCookie = readCookieValue(
    requestHeaders.get("cookie"),
    INTERNAL_ACCESS_JWT_COOKIE,
  );
  if (bridgedCookie) return bridgedCookie;

  // Cloudflare also places the same signed application token in the
  // CF_Authorization browser cookie. Vinext may reconstruct the server
  // request without preserving Cloudflare's injected assertion header, so the
  // cookie is a safe fallback because the token still undergoes full signature,
  // issuer, audience, and expiry verification below.
  return readCookieValue(requestHeaders.get("cookie"), "CF_Authorization");
}

function readCookieValue(
  cookieHeader: string | null,
  expectedName: string,
): string | null {
  if (!cookieHeader) return null;
  const normalizedExpected = expectedName.toLowerCase();

  for (const cookiePart of cookieHeader.split(";")) {
    const separator = cookiePart.indexOf("=");
    if (separator < 0) continue;
    const name = cookiePart.slice(0, separator).trim().toLowerCase();
    if (name !== normalizedExpected) continue;

    const rawValue = cookiePart.slice(separator + 1).trim();
    if (!rawValue) return null;
    try {
      return decodeURIComponent(rawValue).trim() || null;
    } catch {
      return rawValue;
    }
  }

  return null;
}

export async function verifyCloudflareAccessJwt(
  token: string,
  {
    audience,
    teamOrigin,
    fetchImpl = runtimeFetch,
    now = new Date(),
  }: {
    audience: string;
    teamOrigin: string;
    fetchImpl?: typeof fetch;
    now?: Date;
  },
): Promise<CloudflareAccessIdentity> {
  const normalizedAudience = normalizeAudience(audience);
  const normalizedOrigin = normalizeTeamOrigin(teamOrigin);
  if (!normalizedAudience || !normalizedOrigin) {
    throw new CloudflareAccessVerificationError(
      "Cloudflare Access configuration is invalid.",
    );
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new CloudflareAccessVerificationError("Malformed Access JWT.");
  }

  const header = parseJwtPart<JwtHeader>(parts[0]);
  const payload = parseJwtPart<JwtPayload>(parts[1]);
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new CloudflareAccessVerificationError(
      "Unsupported Access JWT algorithm or key identifier.",
    );
  }

  const signature = decodeBase64Url(parts[2]);
  const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  let key = await loadSigningKey(normalizedOrigin, header.kid, fetchImpl);
  let verified = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    signature,
    signedData,
  );

  // A cached JWKS can briefly contain a rotated key with the same `kid`.
  // Refresh once before rejecting a valid Access token.
  if (!verified) {
    key = await loadSigningKey(normalizedOrigin, header.kid, fetchImpl, true);
    verified = await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      key,
      signature,
      signedData,
    );
  }
  if (!verified) {
    throw new CloudflareAccessVerificationError(
      "Access JWT signature verification failed.",
    );
  }

  const nowSeconds = Math.floor(now.getTime() / 1000);
  const issuer = typeof payload.iss === "string" ? payload.iss : "";
  if (stripTrailingSlash(issuer) !== normalizedOrigin) {
    throw new CloudflareAccessVerificationError("Access JWT issuer mismatch.");
  }
  if (!audienceContains(payload.aud, normalizedAudience)) {
    throw new CloudflareAccessVerificationError("Access JWT audience mismatch.");
  }
  if (
    !Number.isInteger(payload.exp) ||
    (payload.exp as number) <= nowSeconds - CLOCK_SKEW_SECONDS
  ) {
    throw new CloudflareAccessVerificationError("Access JWT has expired.");
  }
  if (
    payload.nbf !== undefined &&
    (!Number.isInteger(payload.nbf) ||
      (payload.nbf as number) > nowSeconds + CLOCK_SKEW_SECONDS)
  ) {
    throw new CloudflareAccessVerificationError("Access JWT is not active yet.");
  }
  if (
    payload.iat !== undefined &&
    (!Number.isInteger(payload.iat) ||
      (payload.iat as number) > nowSeconds + CLOCK_SKEW_SECONDS)
  ) {
    throw new CloudflareAccessVerificationError(
      "Access JWT issue time is invalid.",
    );
  }

  const email = normalizeEmail(payload.email);
  const subject = normalizeSubject(payload.sub);
  if (!email || !subject) {
    throw new CloudflareAccessVerificationError(
      "Access JWT does not contain a valid identity.",
    );
  }

  return {
    subject,
    email,
    name: normalizeName(payload.name),
    issuedAt: Number.isInteger(payload.iat)
      ? (payload.iat as number)
      : nowSeconds,
    expiresAt: payload.exp as number,
    authenticationMethods: normalizeAuthenticationMethods(payload.amr),
  };
}

export function normalizeTeamOrigin(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (
      url.protocol !== "https:" ||
      !url.hostname.endsWith(".cloudflareaccess.com") ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return stripTrailingSlash(url.origin);
  } catch {
    return null;
  }
}

function normalizeAudience(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized && /^[A-Za-z0-9_-]{20,256}$/.test(normalized)
    ? normalized
    : null;
}

async function loadSigningKey(
  teamOrigin: string,
  kid: string,
  fetchImpl: typeof fetch,
  forceRefresh = false,
): Promise<CryptoKey> {
  const keys = await loadJwks(teamOrigin, fetchImpl, forceRefresh);
  const jwk = keys.find(
    (candidate) =>
      candidate.kid === kid &&
      candidate.kty === "RSA" &&
      (!candidate.alg || candidate.alg === "RS256") &&
      (!candidate.use || candidate.use === "sig"),
  );
  if (!jwk && !forceRefresh) {
    return loadSigningKey(teamOrigin, kid, fetchImpl, true);
  }
  if (!jwk) {
    throw new CloudflareAccessVerificationError(
      "Access JWT signing key was not found.",
    );
  }
  return importSigningKey(jwk);
}

async function loadJwks(
  teamOrigin: string,
  fetchImpl: typeof fetch,
  force = false,
): Promise<AccessJsonWebKey[]> {
  const cached = jwksCache.get(teamOrigin);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.keys;

  const response = await fetchImpl(`${teamOrigin}/cdn-cgi/access/certs`, {
    headers: { accept: "application/json" },
    redirect: "manual",
  });
  if (!response.ok) {
    throw new CloudflareAccessVerificationError(
      "Unable to load Cloudflare Access signing keys.",
    );
  }
  const body = (await response.json()) as JsonWebKeySet;
  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    throw new CloudflareAccessVerificationError(
      "Cloudflare Access returned an invalid JWKS response.",
    );
  }
  jwksCache.set(teamOrigin, {
    keys: body.keys,
    expiresAt: Date.now() + JWKS_CACHE_MS,
  });
  return body.keys;
}

function importSigningKey(jwk: AccessJsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

function parseJwtPart<T>(value: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
  } catch {
    throw new CloudflareAccessVerificationError("Malformed Access JWT data.");
  }
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new CloudflareAccessVerificationError("Invalid base64url data.");
  }
  const padded = `${value.replaceAll("-", "+").replaceAll("_", "/")}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function audienceContains(value: unknown, expected: string): boolean {
  if (typeof value === "string") return value === expected;
  return Array.isArray(value) && value.some((entry) => entry === expected);
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) &&
    !/[\u0000-\u001F\u007F]/.test(normalized)
    ? normalized
    : null;
}

function normalizeSubject(value: unknown): string | null {
  return typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 512 &&
    !/[\u0000-\u001F\u007F]/.test(value)
    ? value
    : null;
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length >= 1 &&
    normalized.length <= 160 &&
    !/[\u0000-\u001F\u007F]/.test(normalized)
    ? normalized
    : null;
}

function normalizeAuthenticationMethods(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter(
        (entry): entry is string =>
          typeof entry === "string" && /^[a-z0-9_-]{1,32}$/i.test(entry),
      ),
    ),
  );
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
