import { describe, expect, it } from "vitest";
import {
  INTERNAL_ACCESS_JWT_COOKIE,
  INTERNAL_ACCESS_JWT_HEADER,
  normalizeTeamOrigin,
  readCloudflareAccessToken,
  verifyCloudflareAccessJwt,
} from "../../lib/auth/cloudflare-access";

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value))
    .toString("base64url");
}

async function createFixture() {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  Object.assign(publicJwk, { kid: "test-key", alg: "RS256", use: "sig" });
  return { pair, publicJwk };
}

async function sign(
  privateKey: CryptoKey,
  payload: Record<string, unknown>,
): Promise<string> {
  const header = encode({ alg: "RS256", kid: "test-key", typ: "JWT" });
  const body = encode(payload);
  const unsigned = `${header}.${body}`;
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${Buffer.from(signature).toString("base64url")}`;
}

describe("Cloudflare Access authentication", () => {
  it("reads the Access assertion header and falls back to the signed browser cookie", () => {
    expect(
      readCloudflareAccessToken(
        new Headers({
          cookie: "other=value; CF_Authorization=cookie-token",
          "cf-access-jwt-assertion": "header-token",
        }),
      ),
    ).toBe("header-token");

    expect(
      readCloudflareAccessToken(
        new Headers({ cookie: "other=value; CF_Authorization=cookie-token" }),
      ),
    ).toBe("cookie-token");

    expect(
      readCloudflareAccessToken(
        new Headers({
          cookie: `other=value; ${INTERNAL_ACCESS_JWT_COOKIE}=worker-token`,
        }),
      ),
    ).toBe("worker-token");
  });

  it("normalizes only valid team domains", () => {
    expect(normalizeTeamOrigin("northline.cloudflareaccess.com")).toBe(
      "https://northline.cloudflareaccess.com",
    );
    expect(normalizeTeamOrigin("https://northline.cloudflareaccess.com/")).toBe(
      "https://northline.cloudflareaccess.com",
    );
    expect(normalizeTeamOrigin("https://example.com")).toBeNull();
  });

  it("verifies signature, issuer, audience, expiry, and identity", async () => {
    const { pair, publicJwk } = await createFixture();
    const now = new Date("2026-07-25T10:00:00Z");
    const token = await sign(pair.privateKey, {
      iss: "https://northline.cloudflareaccess.com",
      aud: ["audience-12345678901234567890"],
      sub: "user-1",
      email: "Owner@Example.com",
      name: "Omar",
      iat: Math.floor(now.getTime() / 1000) - 10,
      exp: Math.floor(now.getTime() / 1000) + 300,
      amr: ["otp"],
    });
    const identity = await verifyCloudflareAccessJwt(token, {
      audience: "audience-12345678901234567890",
      teamOrigin: "northline.cloudflareaccess.com",
      now,
      fetchImpl: async () =>
        new Response(JSON.stringify({ keys: [publicJwk] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    expect(identity).toMatchObject({
      subject: "user-1",
      email: "owner@example.com",
      name: "Omar",
      authenticationMethods: ["otp"],
    });
  });

  it("rejects a wrong audience", async () => {
    const { pair, publicJwk } = await createFixture();
    const now = new Date("2026-07-25T10:00:00Z");
    const token = await sign(pair.privateKey, {
      iss: "https://northline.cloudflareaccess.com",
      aud: ["different-audience-1234567890"],
      sub: "user-1",
      email: "owner@example.com",
      exp: Math.floor(now.getTime() / 1000) + 300,
    });
    await expect(
      verifyCloudflareAccessJwt(token, {
        audience: "audience-12345678901234567890",
        teamOrigin: "northline.cloudflareaccess.com",
        now,
        fetchImpl: async () =>
          new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 }),
      }),
    ).rejects.toThrow("audience mismatch");
  });
});


it("reads the Worker-verified Access bridge before browser fallbacks", () => {
  const headers = new Headers({
    [INTERNAL_ACCESS_JWT_HEADER]: "verified.jwt.value",
    "cf-access-jwt-assertion": "raw.jwt.value",
  });
  expect(readCloudflareAccessToken(headers)).toBe("verified.jwt.value");
  expect(
    readCloudflareAccessToken(headers, { allowInternalBridge: false }),
  ).toBe("raw.jwt.value");
});
