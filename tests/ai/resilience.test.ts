import { describe, expect, it } from "vitest";
import {
  AiRuntimeError,
  CircuitBreaker,
  executeWithResilience,
} from "../../lib/ai";

describe("AI resilience primitives", () => {
  it("retries transient errors and resets the provider circuit on success", async () => {
    let calls = 0;
    const circuit = new CircuitBreaker(2, 5_000);
    const value = await executeWithResilience({
      circuit,
      attempts: 2,
      sleeper: async () => undefined,
      operation: async () => {
        calls += 1;
        if (calls === 1) {
          throw new AiRuntimeError(
            "AI_PROVIDER_RATE_LIMITED",
            "rate limited",
            true,
          );
        }
        return "ok";
      },
    });
    expect(value).toBe("ok");
    expect(calls).toBe(2);
    expect(circuit.snapshot()).toMatchObject({
      state: "closed",
      consecutiveFailures: 0,
    });
  });

  it("opens after consecutive failed operations and permits one recovery probe", async () => {
    let now = Date.parse("2026-07-24T00:00:00.000Z");
    const circuit = new CircuitBreaker(2, 1_000, () => now);
    const fail = () =>
      executeWithResilience({
        circuit,
        attempts: 1,
        operation: async () => {
          throw new AiRuntimeError(
            "AI_PROVIDER_UNAVAILABLE",
            "temporary",
            true,
          );
        },
      });
    await expect(fail()).rejects.toMatchObject({
      code: "AI_PROVIDER_UNAVAILABLE",
    });
    await expect(fail()).rejects.toMatchObject({
      code: "AI_PROVIDER_UNAVAILABLE",
    });
    await expect(fail()).rejects.toMatchObject({ code: "AI_CIRCUIT_OPEN" });
    now += 1_001;
    circuit.assertRequestAllowed();
    expect(circuit.snapshot().state).toBe("half_open");
    expect(() => circuit.assertRequestAllowed()).toThrowError(
      expect.objectContaining({ code: "AI_CIRCUIT_OPEN" }),
    );
  });
});
