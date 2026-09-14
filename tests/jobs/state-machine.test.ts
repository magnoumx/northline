import { describe, expect, it } from "vitest";
import {
  assertLeaseOwner,
  calculateRetryAt,
  canClaimJob,
  failureDisposition,
} from "../../lib/jobs";

describe("durable job state rules", () => {
  it("uses bounded exponential retry timing", () => {
    const failedAt = new Date("2026-07-24T12:00:00.000Z");
    expect(
      calculateRetryAt({ failedAt, attemptCount: 1 }).toISOString(),
    ).toBe("2026-07-24T12:00:01.000Z");
    expect(
      calculateRetryAt({ failedAt, attemptCount: 4 }).toISOString(),
    ).toBe("2026-07-24T12:00:08.000Z");
  });

  it("moves the final bounded attempt to the dead-letter state", () => {
    expect(failureDisposition(2, 3)).toBe("RETRY_WAIT");
    expect(failureDisposition(3, 3)).toBe("DEAD_LETTER");
  });

  it("will not claim cancelled, future, or actively leased work", () => {
    const now = new Date("2026-07-24T12:00:00.000Z");
    const job = {
      id: "job_1",
      state: "QUEUED" as const,
      attemptCount: 0,
      maximumAttempts: 5,
      availableAt: now,
      lockedBy: null,
      lockedUntil: null,
      cancelledAt: null,
    };
    expect(canClaimJob(job, now)).toBe(true);
    expect(
      canClaimJob(
        { ...job, availableAt: new Date("2026-07-24T12:01:00.000Z") },
        now,
      ),
    ).toBe(false);
    expect(canClaimJob({ ...job, cancelledAt: now }, now)).toBe(false);
  });

  it("requires the exact unexpired worker lease for completion", () => {
    expect(() =>
      assertLeaseOwner(
        {
          state: "RUNNING",
          lockedBy: "worker_a",
          lockedUntil: new Date("2026-07-24T12:01:00.000Z"),
        },
        "worker_b",
        new Date("2026-07-24T12:00:00.000Z"),
      ),
    ).toThrow(/lease/i);
  });
});
