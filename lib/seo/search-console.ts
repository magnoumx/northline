/**
 * Google Search Console, read into the newsroom.
 *
 * Nothing in this codebase ever asked Google what actually happened after
 * publication - which pages it indexed, what people searched to find them,
 * how often a result was shown versus clicked. The autonomous pipeline
 * published entirely blind to that. This is the missing feedback loop: a
 * service-account connector, read-only, scoped to Search Console data alone.
 *
 * Authenticates as a Google service account using the JWT bearer flow
 * (RFC 7523), signed with the Web Crypto API rather than a Node-specific
 * crypto module so it runs unmodified in the Cloudflare Workers runtime this
 * project actually deploys to.
 */

export type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  token_uri: string;
};

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlEncodeString(value: string): string {
  return base64UrlEncode(new TextEncoder().encode(value));
}

/**
 * A PEM block is the DER key, base64-encoded, wrapped in header/footer lines.
 * Web Crypto's `importKey` wants the raw DER bytes, not the PEM text.
 */
function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/u, "")
    .replace(/-----END [^-]+-----/u, "")
    .replaceAll(/\s+/gu, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

/** The unsigned JWT is deterministic from its inputs, so it is directly testable. */
export function buildJwtClaims(
  credentials: Pick<ServiceAccountCredentials, "client_email" | "token_uri">,
  scope: string,
  issuedAt: number,
): string {
  const header = base64UrlEncodeString(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64UrlEncodeString(
    JSON.stringify({
      iss: credentials.client_email,
      scope,
      aud: credentials.token_uri,
      iat: issuedAt,
      // Google rejects anything past one hour; matching that exactly avoids
      // requesting a token that is already stale by the time it is used.
      exp: issuedAt + 3600,
    }),
  );
  return `${header}.${claims}`;
}

async function signJwt(
  unsignedJwt: string,
  privateKeyPem: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedJwt),
  );
  return `${unsignedJwt}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export type AccessTokenResult =
  | { ok: true; accessToken: string; expiresAt: number }
  | { ok: false; detail: string };

/**
 * Exchanges the service account's signature for a short-lived access token.
 * Never throws: a credentials or network problem is data the caller reports,
 * not a crash that takes an unrelated newsroom page down with it.
 */
export async function fetchAccessToken(
  credentials: ServiceAccountCredentials,
  scope: string,
  options: { fetchImpl?: typeof fetch; now?: () => number } = {},
): Promise<AccessTokenResult> {
  const now = options.now?.() ?? Date.now();
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const issuedAt = Math.floor(now / 1000);
    const jwt = await signJwt(buildJwtClaims(credentials, scope, issuedAt), credentials.private_key);
    const response = await fetchImpl(credentials.token_uri, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return { ok: false, detail: `Token exchange returned ${response.status}.` };
    }
    const body = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof body.access_token !== "string") {
      return { ok: false, detail: "Token exchange response had no access_token." };
    }
    const expiresInSeconds = typeof body.expires_in === "number" ? body.expires_in : 3600;
    return {
      ok: true,
      accessToken: body.access_token,
      expiresAt: now + expiresInSeconds * 1000,
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message.slice(0, 200) : "unreachable",
    };
  }
}

const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

/** A token is reused across calls within one Worker isolate until near expiry. */
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

/** Test-only: a fresh isolate never carries a token from a previous test. */
export function resetAccessTokenCacheForTests(): void {
  cachedToken = null;
}

async function getCachedAccessToken(
  credentials: ServiceAccountCredentials,
  options: { fetchImpl?: typeof fetch; now?: () => number } = {},
): Promise<AccessTokenResult> {
  const now = options.now?.() ?? Date.now();
  // Refreshed a minute early so a call in flight never races an expiring token.
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) {
    return { ok: true, ...cachedToken };
  }
  const result = await fetchAccessToken(credentials, SEARCH_CONSOLE_SCOPE, options);
  if (result.ok) cachedToken = { accessToken: result.accessToken, expiresAt: result.expiresAt };
  return result;
}

export type SearchAnalyticsRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchAnalyticsResult =
  | { ok: true; rows: SearchAnalyticsRow[] }
  | { ok: false; detail: string };

/**
 * Search performance for the property, dimensioned by query or by page.
 *
 * `siteUrl` must be exactly how the property is registered in Search
 * Console - `sc-domain:usnorthline.com` for a Domain property, not the https
 * URL - or every call fails with an unhelpful 403.
 */
export async function querySearchAnalytics(
  input: {
    credentials: ServiceAccountCredentials;
    siteUrl: string;
    startDate: string;
    endDate: string;
    dimensions: readonly ("query" | "page" | "date" | "country" | "device")[];
    rowLimit?: number;
  },
  options: { fetchImpl?: typeof fetch; now?: () => number } = {},
): Promise<SearchAnalyticsResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const token = await getCachedAccessToken(input.credentials, options);
  if (!token.ok) return { ok: false, detail: token.detail };

  try {
    const response = await fetchImpl(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
        input.siteUrl,
      )}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          startDate: input.startDate,
          endDate: input.endDate,
          dimensions: input.dimensions,
          rowLimit: Math.max(1, Math.min(1000, input.rowLimit ?? 100)),
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      return {
        ok: false,
        detail:
          response.status === 403
            ? "Search Console refused the request - the service account is not a user on this property, or siteUrl does not match how it is registered."
            : `Search Console returned ${response.status}.`,
      };
    }
    const body = (await response.json()) as { rows?: SearchAnalyticsRow[] };
    return { ok: true, rows: body.rows ?? [] };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message.slice(0, 200) : "unreachable",
    };
  }
}

export type SearchConsoleOverview = {
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number;
  topQueries: SearchAnalyticsRow[];
  topPages: SearchAnalyticsRow[];
  /** Impressions exist but almost nobody clicks - a title/deck worth revisiting. */
  lowCtrPages: SearchAnalyticsRow[];
};

/**
 * The one call a newsroom dashboard actually wants: totals, and the two
 * worklists an editor can act on - what is winning, and what is being shown
 * but ignored.
 */
export async function readSearchConsoleOverview(
  input: {
    credentials: ServiceAccountCredentials;
    siteUrl: string;
    startDate: string;
    endDate: string;
  },
  options: { fetchImpl?: typeof fetch; now?: () => number } = {},
): Promise<{ ok: true; overview: SearchConsoleOverview } | { ok: false; detail: string }> {
  const [queries, pages] = await Promise.all([
    querySearchAnalytics({ ...input, dimensions: ["query"], rowLimit: 25 }, options),
    querySearchAnalytics({ ...input, dimensions: ["page"], rowLimit: 100 }, options),
  ]);
  if (!queries.ok) return { ok: false, detail: queries.detail };
  if (!pages.ok) return { ok: false, detail: pages.detail };

  const clicks = pages.rows.reduce((total, row) => total + row.clicks, 0);
  const impressions = pages.rows.reduce((total, row) => total + row.impressions, 0);
  // The property-wide average, not an average of per-page averages: summing
  // per-row CTR would weight a one-impression page the same as one with ten
  // thousand.
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const weightedPosition = pages.rows.reduce(
    (total, row) => total + row.position * row.impressions,
    0,
  );
  const averagePosition = impressions > 0 ? weightedPosition / impressions : 0;

  const lowCtrPages = pages.rows
    .filter((row) => row.impressions >= 20 && row.ctr < 0.01)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 25);

  return {
    ok: true,
    overview: {
      clicks,
      impressions,
      ctr,
      averagePosition,
      topQueries: [...queries.rows].sort((a, b) => b.clicks - a.clicks).slice(0, 25),
      topPages: [...pages.rows].sort((a, b) => b.clicks - a.clicks).slice(0, 25),
      lowCtrPages,
    },
  };
}

export function parseServiceAccountCredentials(
  json: string | undefined,
): ServiceAccountCredentials | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Partial<ServiceAccountCredentials>;
    if (
      typeof parsed.client_email === "string" &&
      typeof parsed.private_key === "string" &&
      typeof parsed.token_uri === "string"
    ) {
      return parsed as ServiceAccountCredentials;
    }
    return null;
  } catch {
    return null;
  }
}
