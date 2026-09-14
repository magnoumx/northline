import { describe, expect, it } from "vitest";
import {
  createCsrfToken,
  verifyCsrfToken,
} from "../../lib/security/csrf";
import {
  validateMutationOrigin,
  validateMutationRequest,
} from "../../lib/security/origin";

const csrfSecret = "csrf-test-secret-with-more-than-thirty-two-characters";

describe("mutation request protection", () => {
  it("requires the expected media type and exact origin", () => {
    const valid = new Request("https://northline.example/api/newsletter", {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        origin: "https://northline.example",
        "sec-fetch-site": "same-origin",
      },
      body: "{}",
    });
    expect(
      validateMutationRequest(valid, {
        allowedOrigins: ["https://northline.example"],
        allowedMediaTypes: ["application/json"],
      }),
    ).toEqual({ allowed: true });

    const simpleCrossSite = new Request(
      "https://northline.example/api/newsletter",
      {
        method: "POST",
        headers: {
          "content-type": "text/plain",
          origin: "https://attacker.example",
          "sec-fetch-site": "cross-site",
        },
        body: "{}",
      },
    );
    expect(
      validateMutationRequest(simpleCrossSite, {
        allowedOrigins: ["https://northline.example"],
        allowedMediaTypes: ["application/json"],
      }),
    ).toMatchObject({
      allowed: false,
      reason: "unsupported_media_type",
      status: 415,
    });
  });

  it("rejects missing, null, malformed, and cross-site origins", () => {
    for (const headers of [
      new Headers(),
      new Headers({ origin: "null" }),
      new Headers({ origin: "not a URL" }),
      new Headers({ origin: "https://attacker.example" }),
      new Headers({
        origin: "https://northline.example",
        "sec-fetch-site": "cross-site",
      }),
    ]) {
      expect(
        validateMutationOrigin(headers, {
          allowedOrigins: ["https://northline.example"],
        }).allowed,
      ).toBe(false);
    }
  });
});

describe("CSRF tokens", () => {
  it("binds a signed, expiring token to its mutation subject", async () => {
    const now = new Date("2026-07-24T12:00:00.000Z");
    const token = await createCsrfToken({
      secret: csrfSecret,
      subject: "newsletter-confirmation:record_12345678",
      now,
      ttlSeconds: 600,
    });
    expect(
      await verifyCsrfToken(token, {
        secret: csrfSecret,
        subject: "newsletter-confirmation:record_12345678",
        now: new Date("2026-07-24T12:05:00.000Z"),
      }),
    ).toMatchObject({ valid: true });
    expect(
      await verifyCsrfToken(token, {
        secret: csrfSecret,
        subject: "newsletter-confirmation:other_12345678",
        now: new Date("2026-07-24T12:05:00.000Z"),
      }),
    ).toEqual({ valid: false, reason: "bad_signature" });
    expect(
      await verifyCsrfToken(token, {
        secret: csrfSecret,
        subject: "newsletter-confirmation:record_12345678",
        now: new Date("2026-07-24T12:11:00.000Z"),
      }),
    ).toEqual({ valid: false, reason: "expired" });
  });
});
