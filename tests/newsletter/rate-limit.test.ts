import { describe, expect, it } from "vitest";
import {
  enforceNewsletterRateLimits,
  type NewsletterRateLimitStore,
  type RateLimitIncrement,
  resolveClientAddress,
  resolveRateLimitSecret,
} from "../../lib/newsletter/rate-limit";

class MemoryCounterStore implements NewsletterRateLimitStore {
  readonly inputs: RateLimitIncrement[] = [];
  readonly counts = new Map<string, number>();

  async increment(input: RateLimitIncrement): Promise<number> {
    this.inputs.push(input);
    const next = (this.counts.get(input.id) ?? 0) + 1;
    this.counts.set(input.id, next);
    return next;
  }
}

describe("newsletter rate limiting", () => {
  it("denies the sixth request in an IP window", async () => {
    const store = new MemoryCounterStore();
    const now = new Date("2026-07-24T12:05:00.000Z");
    let result = { allowed: true, retryAfterSeconds: 0 };

    for (let attempt = 0; attempt < 6; attempt += 1) {
      result = await enforceNewsletterRateLimits({
        store,
        email: `reader-${attempt}@example.com`,
        clientAddress: "203.0.113.7",
        secret: "a sufficiently long test-only secret",
        now,
      });
    }

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(600);
  });

  it("denies the fourth request in an email window", async () => {
    const store = new MemoryCounterStore();
    const now = new Date("2026-07-24T12:05:00.000Z");
    let result = { allowed: true, retryAfterSeconds: 0 };

    for (let attempt = 0; attempt < 4; attempt += 1) {
      result = await enforceNewsletterRateLimits({
        store,
        email: "Reader@Example.com",
        clientAddress: `203.0.113.${attempt}`,
        secret: "a sufficiently long test-only secret",
        now,
      });
    }

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(3_300);
  });

  it("persists only keyed hashes, never raw IP or email values", async () => {
    const store = new MemoryCounterStore();
    await enforceNewsletterRateLimits({
      store,
      email: "private@example.com",
      clientAddress: "198.51.100.21",
      secret: "a sufficiently long test-only secret",
      now: new Date("2026-07-24T12:00:00.000Z"),
    });

    const persisted = JSON.stringify(store.inputs);
    expect(persisted).not.toContain("private@example.com");
    expect(persisted).not.toContain("198.51.100.21");
    expect(store.inputs.every((input) => input.keyHash.length === 64)).toBe(true);
  });

  it("requires an explicit secret in production", () => {
    expect(() => resolveRateLimitSecret(undefined, true)).toThrow(
      "RATE_LIMIT_SECRET",
    );
    expect(() => resolveRateLimitSecret("too-short", true)).toThrow(
      "RATE_LIMIT_SECRET",
    );
    expect(
      resolveRateLimitSecret("a-production-secret-with-32-characters", true),
    ).toBe("a-production-secret-with-32-characters");
    expect(resolveRateLimitSecret(undefined, false)).toContain("local-preview");
  });

  it("ignores unattested forwarding headers", async () => {
    const headers = new Headers({
      "cf-connecting-ip": "203.0.113.8",
      "x-forwarded-for": "198.51.100.5, 198.51.100.6",
    });
    await expect(resolveClientAddress(headers, {})).resolves.toBe(
      "unavailable",
    );
  });
});
