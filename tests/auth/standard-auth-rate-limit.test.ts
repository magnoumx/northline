import { describe, expect, it } from "vitest";
import {
  enforceMagicLinkRequestRateLimit,
  enforceMagicLinkVerifyRateLimit,
  type AuthRateLimitIncrement,
  type AuthRateLimitStore,
} from "../../lib/auth/standard-rate-limit";

const secret = "rate-limit-test-secret-with-at-least-32-characters";
const now = new Date("2026-07-24T12:00:00.000Z");

describe("standard authentication rate limits", () => {
  it("limits repeated email requests without requiring a client IP", async () => {
    const store = new MemoryRateLimitStore();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await expect(
        enforceMagicLinkRequestRateLimit({
          store,
          email: "reader@example.com",
          clientAddress: "unavailable",
          secret,
          now,
        }),
      ).resolves.toMatchObject({ allowed: true });
    }
    const limited = await enforceMagicLinkRequestRateLimit({
      store,
      email: "reader@example.com",
      clientAddress: "unavailable",
      secret,
      now,
    });
    expect(limited.allowed).toBe(false);
    expect(limited.retryAfterSeconds).toBeGreaterThan(0);
    expect(
      [...store.counts.keys()].every((key) => !key.includes("reader@example.com")),
    ).toBe(true);
  });

  it("separately limits verification attempts by an attested address", async () => {
    const store = new MemoryRateLimitStore();
    for (let attempt = 1; attempt <= 20; attempt += 1) {
      await enforceMagicLinkVerifyRateLimit({
        store,
        clientAddress: "203.0.113.8",
        secret,
        now,
      });
    }
    await expect(
      enforceMagicLinkVerifyRateLimit({
        store,
        clientAddress: "203.0.113.8",
        secret,
        now,
      }),
    ).resolves.toMatchObject({ allowed: false });
    await expect(
      enforceMagicLinkVerifyRateLimit({
        store,
        clientAddress: "unavailable",
        secret,
        now,
      }),
    ).resolves.toEqual({ allowed: true, retryAfterSeconds: 0 });
  });
});

class MemoryRateLimitStore implements AuthRateLimitStore {
  counts = new Map<string, number>();

  async increment(input: AuthRateLimitIncrement): Promise<number> {
    const count = (this.counts.get(input.id) ?? 0) + 1;
    this.counts.set(input.id, count);
    return count;
  }
}
