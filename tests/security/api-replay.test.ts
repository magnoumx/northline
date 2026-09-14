import { describe, expect, it } from "vitest";
import {
  claimReplayProtectedValue,
  validateIdempotencyKey,
  type ReplayStore,
} from "../../lib/security/api";

class MemoryReplayStore implements ReplayStore {
  private readonly claimed = new Set<string>();

  async claimOnce(digest: string): Promise<boolean> {
    if (this.claimed.has(digest)) return false;
    this.claimed.add(digest);
    return true;
  }
}

describe("API idempotency and replay primitives", () => {
  it("accepts constrained idempotency keys only", () => {
    expect(validateIdempotencyKey("campaign:request_12345678")).toEqual({
      valid: true,
      value: "campaign:request_12345678",
    });
    for (const value of [null, "short", "contains spaces 123456", "<script>123456789"]) {
      expect(validateIdempotencyKey(value)).toEqual({ valid: false });
    }
  });

  it("allows one atomic claim and rejects a replay", async () => {
    const store = new MemoryReplayStore();
    const input = {
      scope: "ad_click",
      value: "signed-event-token-123456789",
      expiresAt: new Date(Date.now() + 60_000),
      store,
    };
    await expect(claimReplayProtectedValue(input)).resolves.toBe(true);
    await expect(claimReplayProtectedValue(input)).resolves.toBe(false);
  });
});
