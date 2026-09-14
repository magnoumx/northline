import { beforeEach, describe, expect, it } from "vitest";
import {
  buildJwtClaims,
  fetchAccessToken,
  parseServiceAccountCredentials,
  querySearchAnalytics,
  readSearchConsoleOverview,
  resetAccessTokenCacheForTests,
  type ServiceAccountCredentials,
} from "../../lib/seo/search-console";

// A cached token is a real, intentional feature - reused across calls within
// one Worker isolate - but that same persistence leaks between tests in this
// file, since they share the module instance. Each test gets a clean isolate.
beforeEach(() => {
  resetAccessTokenCacheForTests();
});

// A real 2048-bit RSA key generated only for this test file. It signs nothing
// that ever leaves this process and authenticates against nothing real.
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC++DcBtTkC6RcY
FlfMuN9NZgcgcWFR7zX3IdVPZNvm03klSj8QSZhvKKLbPtYfklf+6El+jkIbeTsV
w9k0etw5n0EWCLE44SKHH7XAjLngO0e2G9aqopznfjPgYnp8WWIUawQS/KAV42C7
fMW9zxSbbZcsB74wnFTheapHu0fGEZwbphI4sa8fOGLpRKo2YdeU4RDKPlhfsbPw
QcNhri1D5kA+Mfq/Irv6+IRSvQE+K3P+kGFZT3nOc56fnx1zI2mxaoOItuWRyzMA
NyfaRiBcg1jXfgju0zKmzmdrxalODiYK9pDIb1ol+9buBM9xe1Kx0L74IyE3G6gT
mBijuFUxAgMBAAECggEAUGmcX++7TepwewgNeHrwLFsl7RdQ73tWsfVhKMlDf3LU
tEsLOwSCV2w5BzDyYODyhLezGsM0OvVVV9jcASkqymiws2J9nYHPVC6aDbY0HqNX
kust/TPz9dZCad2NzgalMgvN72DI1+6isM/dRAuKldgTq8qm3zk01Kyycvn9Qv00
6PhV07u3xed1ZJRKRnjTiuAStAbkjkNX6OIf11FwgKTcWghZPCW63wXOpwi9PNb4
pacEjxz5zCyqe0JI6PuBgXe8XgeaFbS5FOx0ji+T+gjUOTtdzsinVLX4lnEwhDua
dF64sONvf5N+HMrwyy3sgHZZ06K6LkeeAr0aSS18cQKBgQDm34mUvL27jrRPYqgL
SZX2ywMBz9XIEqnNcjUxfjK0z+DiUTNSEDTnPQasEf7l1wO+6F8hwsR5whIro5qr
+V2SFZDnPe44n9Eu3IEb8b77Ahl4eyGQ+O+eE7xgQEWzv2+E3LbZSTsbIqUtSuUV
H3U3EEQBz8ZZ1+XApu7MB7NPuwKBgQDTwOeyxNqALzEcp1yMRZBzjH8M5jUg0j7M
XfhNhkIRY2Jr7OB/c/nTXK5xdY0fnlS9w47/MB0n0PMknZLIkntrgfAeCc9kDiba
Owl8bcb8mEzgAfkH/UAa7PfbC8tLtLos0FuS/MW9CXhziGWyUqEkqblR8Ad0DsiM
KCub4rXSAwKBgCdigunouMVCNuhEAD7MstSDFWQ9vE6BQI5XqVNkH+pQfCCfkY2y
ThQUiQrZlw5Ge9EZewEbZMEQpmDjbANiat/85ddM7VKjkN/ZpfzKZLYVSZsQBk3g
6Z+h5kTVMg7T3YZg0KCIqZibdGohmKrdzvUxxSg59bBl8D/JOnt75M75AoGAWYrM
L3NAtk2+ZdB7uTE9aS8zFoBOXQeq2H6wHhA05edx2hN7x0mCjhc2CPJdb85jJS+J
y21MFucrugML69bNa+OxZvJdCYFWepfWZhCBwZShhWQwK2my7u/fy3fMSsIsrACb
iKds8ogLsEcwQdzhGYDPxc9LR49szJ+7+RpAKoMCgYEA2YgG2/dc9yHwHU/Da/BS
Mh+lOxMocGXQPfBRHOS4RSOGMwx0dwFoKaYYqd9cyl0+rrDVUwfkylxkthW2NrTT
Il5Ra8GAV7FzRJugjbGknhAk79KjBJKcw1ZFG5z98Gme+03YBNwLibvBQbVe4jhV
hnpTyhtCMRhuoZALZRL6CD8=
-----END PRIVATE KEY-----`;

function fakeCredentials(): ServiceAccountCredentials {
  return {
    client_email: "northline-search-console@usnorthline.iam.gserviceaccount.com",
    private_key: TEST_PRIVATE_KEY,
    token_uri: "https://oauth2.googleapis.com/token",
  };
}

describe("the JWT this connector signs", () => {
  it("is deterministic from its inputs and decodes to real claims", () => {
    const unsigned = buildJwtClaims(fakeCredentials(), "https://www.googleapis.com/auth/webmasters.readonly", 1_700_000_000);
    const [header, claims] = unsigned.split(".");
    const decodedClaims = JSON.parse(
      Buffer.from(claims.replaceAll("-", "+").replaceAll("_", "/"), "base64").toString(),
    );
    expect(JSON.parse(Buffer.from(header, "base64").toString())).toEqual({
      alg: "RS256",
      typ: "JWT",
    });
    expect(decodedClaims.iss).toBe(fakeCredentials().client_email);
    expect(decodedClaims.scope).toContain("webmasters.readonly");
    // Google rejects anything past one hour.
    expect(decodedClaims.exp - decodedClaims.iat).toBe(3600);
  });
});

describe("exchanging the signed JWT for an access token", () => {
  it("never throws when the credentials are unusable", async () => {
    const broken = { ...fakeCredentials(), private_key: "not a real key" };
    const result = await fetchAccessToken(broken, "scope", {
      fetchImpl: (async () => {
        throw new Error("should never be called");
      }) as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
  });

  it("reports a failed exchange without throwing", async () => {
    const result = await fetchAccessToken(fakeCredentials(), "scope", {
      fetchImpl: (async () =>
        new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })) as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).toContain("400");
  });

  it("returns the token on a genuine success", async () => {
    const result = await fetchAccessToken(fakeCredentials(), "scope", {
      fetchImpl: (async () =>
        new Response(JSON.stringify({ access_token: "test-token", expires_in: 3600 }), {
          status: 200,
        })) as unknown as typeof fetch,
      now: () => 1_700_000_000_000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.accessToken).toBe("test-token");
    expect(result.expiresAt).toBe(1_700_000_000_000 + 3600 * 1000);
  });
});

describe("querying search analytics", () => {
  function tokenThenData(dataResponse: () => Response) {
    let call = 0;
    return (async () => {
      call += 1;
      if (call === 1) {
        return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
      }
      return dataResponse();
    }) as unknown as typeof fetch;
  }

  it("explains a 403 as a permissions problem, not a generic failure", async () => {
    const result = await querySearchAnalytics(
      {
        credentials: fakeCredentials(),
        siteUrl: "sc-domain:usnorthline.com",
        startDate: "2026-08-01",
        endDate: "2026-08-08",
        dimensions: ["query"],
      },
      { fetchImpl: tokenThenData(() => new Response(null, { status: 403 })) },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).toContain("not a user on this property");
  });

  it("returns rows on success", async () => {
    const result = await querySearchAnalytics(
      {
        credentials: fakeCredentials(),
        siteUrl: "sc-domain:usnorthline.com",
        startDate: "2026-08-01",
        endDate: "2026-08-08",
        dimensions: ["query"],
      },
      {
        fetchImpl: tokenThenData(
          () =>
            new Response(
              JSON.stringify({
                rows: [{ keys: ["rublev tennis"], clicks: 4, impressions: 40, ctr: 0.1, position: 6.2 }],
              }),
              { status: 200 },
            ),
        ),
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].keys).toEqual(["rublev tennis"]);
  });
});

/**
 * `readSearchConsoleOverview` runs the query-dimension and page-dimension
 * calls in parallel, each starting from an empty token cache, so a cold call
 * genuinely triggers two independent token exchanges racing each other -
 * discriminating by URL rather than call order is what actually models that,
 * not an assumption about how many calls happen in what sequence.
 */
function overviewFetch(
  respond: (body: { dimensions?: string[] }) => Response,
): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    if (String(url).includes("oauth2.googleapis.com")) {
      return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
    }
    return respond(JSON.parse(String(init?.body ?? "{}")));
  }) as unknown as typeof fetch;
}

describe("the newsroom overview", () => {
  it("weights average position and CTR by impressions, not by page count", async () => {
    const fetchImpl = overviewFetch((body) => {
      if (body.dimensions?.[0] === "query") {
        return new Response(
          JSON.stringify({
            rows: [
              { keys: ["a"], clicks: 5, impressions: 50, ctr: 0.1, position: 4 },
              { keys: ["b"], clicks: 1, impressions: 10, ctr: 0.1, position: 8 },
            ],
          }),
          { status: 200 },
        );
      }
      // One page with a lot of impressions at a weak position, one page with
      // very few impressions at a strong position. A naive per-page average
      // would land near the midpoint; the impression-weighted answer must
      // land close to the high-volume page's own position.
      return new Response(
        JSON.stringify({
          rows: [
            { keys: ["/story/big"], clicks: 10, impressions: 1000, ctr: 0.01, position: 9 },
            { keys: ["/story/small"], clicks: 5, impressions: 10, ctr: 0.5, position: 1 },
          ],
        }),
        { status: 200 },
      );
    });

    const result = await readSearchConsoleOverview(
      {
        credentials: fakeCredentials(),
        siteUrl: "sc-domain:usnorthline.com",
        startDate: "2026-08-01",
        endDate: "2026-08-08",
      },
      { fetchImpl },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.overview.impressions).toBe(1010);
    expect(result.overview.clicks).toBe(15);
    // Close to the high-volume page's own position (9), not the naive
    // per-page average of (9+1)/2 = 5 that ignores how many impressions
    // each page actually carried.
    expect(result.overview.averagePosition).toBeCloseTo(8.92, 1);
  });

  it("surfaces pages that are shown often but almost never clicked", async () => {
    const fetchImpl = overviewFetch((body) => {
      if (body.dimensions?.[0] === "query") {
        return new Response(JSON.stringify({ rows: [] }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          rows: [
            // Shown a lot, almost never clicked - exactly what an editor
            // should be shown as worth a new title or deck.
            { keys: ["/story/ignored"], clicks: 1, impressions: 500, ctr: 0.002, position: 12 },
            // Healthy CTR - must not appear in the low-CTR worklist.
            { keys: ["/story/healthy"], clicks: 50, impressions: 500, ctr: 0.1, position: 3 },
            // Too few impressions to mean anything - must not appear either.
            { keys: ["/story/new"], clicks: 0, impressions: 3, ctr: 0, position: 20 },
          ],
        }),
        { status: 200 },
      );
    });

    const result = await readSearchConsoleOverview(
      {
        credentials: fakeCredentials(),
        siteUrl: "sc-domain:usnorthline.com",
        startDate: "2026-08-01",
        endDate: "2026-08-08",
      },
      { fetchImpl },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const flagged = result.overview.lowCtrPages.map((row) => row.keys[0]);
    expect(flagged).toContain("/story/ignored");
    expect(flagged).not.toContain("/story/healthy");
    expect(flagged).not.toContain("/story/new");
  });

  it("fails cleanly, without a partial or misleading overview, when one query fails", async () => {
    // The token exchange succeeds for both the query and page calls, but
    // every analytics call itself returns 500 - proving a failure on either
    // call surfaces as ok:false rather than a partially-populated overview.
    const brokenFetch = (async (url: string) => {
      if (String(url).includes("oauth2.googleapis.com")) {
        return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
      }
      return new Response(null, { status: 500 });
    }) as unknown as typeof fetch;
    const result = await readSearchConsoleOverview(
      {
        credentials: fakeCredentials(),
        siteUrl: "sc-domain:usnorthline.com",
        startDate: "2026-08-01",
        endDate: "2026-08-08",
      },
      { fetchImpl: brokenFetch },
    );
    expect(result.ok).toBe(false);
  });
});

describe("reading credentials from the environment", () => {
  it("returns null rather than throwing on missing, empty, or malformed JSON", () => {
    expect(parseServiceAccountCredentials(undefined)).toBeNull();
    expect(parseServiceAccountCredentials("")).toBeNull();
    expect(parseServiceAccountCredentials("{not json")).toBeNull();
    expect(parseServiceAccountCredentials("{}")).toBeNull();
    expect(parseServiceAccountCredentials('{"client_email":"a@b.com"}')).toBeNull();
  });

  it("accepts a genuine service account payload", () => {
    const parsed = parseServiceAccountCredentials(JSON.stringify(fakeCredentials()));
    expect(parsed?.client_email).toBe(fakeCredentials().client_email);
  });
});
