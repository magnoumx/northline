import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repository = readFileSync(
  fileURLToPath(new URL("../../lib/audio/d1-repository.ts", import.meta.url)),
  "utf8",
);

describe("audio reservation retries", () => {
  it("advances the retry key from prior reservations, not generation attempts", () => {
    // The regression: an attempt abandoned before generating left
    // generationAttempt at 0, so the retry key never changed and every retry
    // collided with the previous reservation.
    expect(repository).not.toContain("row.generationAttempt > 0");
    expect(repository).toContain("priorReservations");
    expect(repository).toContain("entry_type = 'RESERVATION'");
    expect(repository).toContain(
      "Math.max(row.generationAttempt, Number(priorReservations?.total ?? 0))",
    );
  });

  it("does not report a duplicate reservation key as a budget failure", () => {
    const rejection = repository.indexOf("failure_code = 'DAILY_BUDGET'");
    expect(rejection).toBeGreaterThan(0);

    const guard = repository.indexOf("duplicateKey");
    expect(guard).toBeGreaterThan(0);
    // The duplicate-key check has to run before anything is marked rejected.
    expect(guard).toBeLessThan(rejection);
    expect(repository).toContain("the retry key did not advance");
  });
});

describe("terminal records", () => {
  it("refuses a claim on an abandoned record without asking for a retry", () => {
    // Twelve rows left FAILED by an exhausted provider allowance kept the queue
    // redelivering the same message, so every narration job failed long after
    // the provider itself had recovered.
    const start = repository.indexOf("async claimGeneration");
    const body = repository.slice(start, start + 1600).replace(/\s+/gu, " ");
    expect(body).toContain(
      'current.state === "FAILED" || current.state === "REJECTED"',
    );
    expect(body).toContain("is not awaiting generation");
    // The third argument is the retryable flag; a terminal record is not.
    expect(body).toMatch(/is not awaiting generation\.`, false,/u);
  });

  it("still replays a completed narration rather than regenerating it", () => {
    const start = repository.indexOf("async claimGeneration");
    const body = repository.slice(start, start + 1600).replace(/\s+/gu, " ");
    expect(body).toContain('return "REPLAY_READY"');
    // The READY check has to come first, or a finished narration would be
    // treated as terminal and dropped.
    expect(body.indexOf("REPLAY_READY")).toBeLessThan(
      body.indexOf('current.state === "FAILED"'),
    );
  });
});
