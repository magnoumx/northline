import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { GoogleProviderAdapter, type AiProviderConfiguration } from "../../lib/ai";
import { AiRuntimeError } from "../../lib/ai/errors";
import { bodyRetryDelayMs, providerHttpError } from "../../lib/ai/providers";

const flat = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8").replace(/\s+/gu, " ");

// Gemini's real 429 body: the human message comes first, the quota id and the
// retry delay come last, well past the 400 characters that used to be kept.
const padding = "x".repeat(600);
const geminiBody = (quotaId: string, delay: string) =>
  `{"error":{"code":429,"message":"You exceeded your current quota. ${padding}","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaId":"${quotaId}"}]},{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"${delay}"}]}}`;

const configuration: AiProviderConfiguration = {
  id: "google",
  apiKey: "google-secret-key",
  model: "google-model",
  tier: "free",
  pricing: { inputUsdPerMillionTokens: 0, outputUsdPerMillionTokens: 0 },
  capabilities: new Set(["classify"]),
  timeoutMs: 1_000,
  retryAttempts: 2,
  circuitFailureThreshold: 5,
  circuitCooldownMs: 5_000,
};

const request = {
  capability: "classify" as const,
  systemPrompt: "Return a classification.",
  userPrompt: "Source content",
  schemaName: "classification",
  jsonSchema: { type: "object" },
  maxOutputTokens: 100,
  temperature: 0,
};

describe("Gemini rate-limit body", () => {
  it("reads the retry delay Gemini puts in the body", () => {
    expect(bodyRetryDelayMs('"retryDelay": "37s"')).toBe(37_000);
    expect(bodyRetryDelayMs('"retryDelay":"1.5s"')).toBe(1_500);
    expect(bodyRetryDelayMs('"retryDelay":"900s"')).toBe(60_000);
    expect(bodyRetryDelayMs("no delay here")).toBeUndefined();
    expect(bodyRetryDelayMs(undefined)).toBeUndefined();
  });

  it("finds a daily quota named after the first 400 characters", () => {
    const error = providerHttpError(
      429,
      new Headers(),
      geminiBody("GenerateRequestsPerDayPerProjectPerModel-FreeTier", "40s"),
    );
    expect(error.quotaScope).toBe("daily");
    expect(error.retryable).toBe(false);
  });

  it("waits the delay Gemini asked for before retrying a short window", async () => {
    const sleeps: number[] = [];
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(geminiBody("GenerateRequestsPerMinutePerProjectPerModel-FreeTier", "21s"), {
          status: 429,
        }),
      )
      .mockResolvedValueOnce(
        new Response(geminiBody("GenerateRequestsPerMinutePerProjectPerModel-FreeTier", "21s"), {
          status: 429,
        }),
      );
    const adapter = new GoogleProviderAdapter(configuration, {
      fetchImpl: fetcher as unknown as typeof fetch,
      sleeper: async (ms: number) => {
        sleeps.push(ms);
      },
    });
    const failure = await adapter.complete(request).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AiRuntimeError);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([21_000]);
    // The message stays short; the full body is only parsed.
    expect((failure as AiRuntimeError).message.length).toBeLessThan(600);
  });
});

describe("every provider attempt is kept", () => {
  it("is collected by the gateway and attached to the final error", () => {
    const gateway = flat("../../lib/ai/gateway.ts");
    expect(gateway).toContain('attemptFailures.push({ provider: provider.id, code: "SKIPPED_OVER_BUDGET" });');
    expect(gateway).toContain("lastError.attempts = [...attemptFailures];");
  });

  it("reaches the run row and the cooldown diagnostic", () => {
    const executors = flat("../../lib/jobs/executors.ts");
    expect(executors).toContain("${error.message}${describeProviderAttempts(error)}");
    expect(executors).toContain("attempts: error?.attempts ?? null,");
  });

  it("records the live-search spend when research fails", () => {
    expect(flat("../../lib/editorial/autonomous-newsroom.ts")).toContain(
      "if (error instanceof AiRuntimeError) error.spentUsd = discoveryCost;",
    );
    expect(flat("../../lib/jobs/executors.ts")).toContain(
      "Math.round((error.spentUsd ?? 0) * 1_000_000)",
    );
  });
});
