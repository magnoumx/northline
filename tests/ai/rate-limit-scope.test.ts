import { describe, expect, it, vi } from "vitest";
import {
  GoogleProviderAdapter,
  type AiProviderConfiguration,
} from "../../lib/ai";
import { AiRuntimeError } from "../../lib/ai/errors";
import { providerHttpError, rateLimitQuotaScope } from "../../lib/ai/providers";
import { nextDailyQuotaResetMs } from "../../lib/jobs/executors";

// Since 2026-10-22 production logged 40-47 rate limits a day: each hourly
// cooldown expired, two autonomous runs asked a provider whose per-day quota
// was already spent, and both failed again. A daily quota must wait for the
// reset, not for an hour.

const geminiDaily =
  '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","details":[{"violations":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}]}}';

describe("rate-limit quota scope", () => {
  it("recognises per-day quota wording", () => {
    expect(rateLimitQuotaScope(geminiDaily)).toBe("daily");
    expect(rateLimitQuotaScope("Daily request limit reached")).toBe("daily");
    expect(rateLimitQuotaScope("requests per day exceeded")).toBe("daily");
  });

  it("treats anything else as a short window", () => {
    expect(rateLimitQuotaScope("GenerateRequestsPerMinutePerProject")).toBe("short");
    expect(rateLimitQuotaScope("")).toBe("short");
    expect(rateLimitQuotaScope(undefined)).toBe("short");
  });

  it("does not retry a spent daily quota", () => {
    const error = providerHttpError(429, new Headers(), geminiDaily);
    expect(error.code).toBe("AI_PROVIDER_RATE_LIMITED");
    expect(error.quotaScope).toBe("daily");
    expect(error.retryable).toBe(false);
  });

  it("still retries a short rate limit and honours Retry-After", () => {
    const error = providerHttpError(429, new Headers({ "retry-after": "3" }), "slow down");
    expect(error.quotaScope).toBe("short");
    expect(error.retryable).toBe(true);
    expect(error.retryAfterMs).toBe(3_000);
  });

  it("names the provider on the error it raises", async () => {
    const configuration: AiProviderConfiguration = {
      id: "google",
      apiKey: "google-secret-key",
      model: "google-model",
      tier: "free",
      pricing: { inputUsdPerMillionTokens: 0, outputUsdPerMillionTokens: 0 },
      capabilities: new Set(["classify"]),
      timeoutMs: 1_000,
      retryAttempts: 2,
      circuitFailureThreshold: 2,
      circuitCooldownMs: 5_000,
    };
    const fetcher = vi.fn().mockResolvedValue(new Response(geminiDaily, { status: 429 }));
    const adapter = new GoogleProviderAdapter(configuration, {
      fetchImpl: fetcher as unknown as typeof fetch,
      sleeper: async () => undefined,
    });
    const failure = await adapter
      .complete({
        capability: "classify",
        systemPrompt: "Return a classification.",
        userPrompt: "Source content",
        schemaName: "classification",
        jsonSchema: { type: "object" },
        maxOutputTokens: 100,
        temperature: 0,
      })
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AiRuntimeError);
    expect(failure).toMatchObject({ provider: "google", quotaScope: "daily" });
    // Not retryable, so the adapter did not spend a second request.
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("next daily quota reset", () => {
  it("lands after now and within a day", () => {
    for (const now of [
      Date.UTC(2026, 9, 29, 6, 0), // just before midnight Pacific
      Date.UTC(2026, 9, 29, 8, 0), // just after
      Date.UTC(2026, 10, 1, 9, 30), // US DST change day
      Date.UTC(2026, 2, 8, 10, 0),
    ]) {
      const reset = nextDailyQuotaResetMs(now);
      expect(reset).toBeGreaterThan(now);
      expect(reset - now).toBeLessThanOrEqual(24 * 60 * 60_000);
    }
  });

  it("waits until just after midnight Pacific", () => {
    // 2026-10-29 06:30 UTC = 23:30 PDT, so the reset is about 35 minutes away.
    const now = Date.UTC(2026, 9, 29, 6, 30);
    const minutes = (nextDailyQuotaResetMs(now) - now) / 60_000;
    expect(minutes).toBeGreaterThanOrEqual(30);
    expect(minutes).toBeLessThanOrEqual(40);
  });
});
