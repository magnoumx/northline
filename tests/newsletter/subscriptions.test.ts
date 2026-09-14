import { describe, expect, it } from "vitest";
import {
  confirmationExpiry,
  evaluateConfirmationRecord,
} from "../../lib/newsletter/subscriptions";
import {
  createConfirmationToken,
  isValidConfirmationToken,
} from "../../lib/newsletter/crypto";

describe("newsletter confirmation lifecycle", () => {
  const now = new Date("2026-07-24T12:00:00.000Z");

  it("creates high-entropy URL-safe tokens", () => {
    const first = createConfirmationToken();
    const second = createConfirmationToken();
    expect(first).not.toBe(second);
    expect(isValidConfirmationToken(first)).toBe(true);
    expect(first).toHaveLength(43);
  });

  it("expires confirmation tokens after the configured window", () => {
    expect(confirmationExpiry(now, "24").toISOString()).toBe(
      "2026-07-25T12:00:00.000Z",
    );
    expect(confirmationExpiry(now, "999").toISOString()).toBe(
      "2026-07-25T12:00:00.000Z",
    );
  });

  it("only confirms pending, unexpired records", () => {
    expect(
      evaluateConfirmationRecord(
        {
          status: "pending",
          confirmationTokenExpiresAt: new Date("2026-07-24T12:00:01.000Z"),
        },
        now,
      ),
    ).toBe("confirmable");
    expect(
      evaluateConfirmationRecord(
        {
          status: "pending",
          confirmationTokenExpiresAt: now,
        },
        now,
      ),
    ).toBe("expired");
    expect(
      evaluateConfirmationRecord(
        {
          status: "confirmed",
          confirmationTokenExpiresAt: now,
        },
        now,
      ),
    ).toBe("already-confirmed");
    expect(
      evaluateConfirmationRecord(
        {
          status: "unsubscribed",
          confirmationTokenExpiresAt: new Date("2026-07-25T12:00:00.000Z"),
        },
        now,
      ),
    ).toBe("invalid");
  });
});
