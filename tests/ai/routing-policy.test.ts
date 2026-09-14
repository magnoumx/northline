import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  AiAdmissionController,
  AiGateway,
  EditorialAiGateway,
  resolveAiCostControls,
  resolveAiRuntimeConfiguration,
  type AiCapabilityGateway,
  type AiProviderAdapter,
  type AiProviderId,
} from "../../lib/ai";

const schema = z.object({ ok: z.literal(true) });

function adapter(
  id: AiProviderId,
  tier: "paid" | "free" | "unknown",
): AiProviderAdapter {
  return {
    id,
    model: `${id}-base-model`,
    tier,
    pricing: {
      inputUsdPerMillionTokens: 0.1,
      outputUsdPerMillionTokens: 0.2,
    },
    capabilities: new Set(["classify"]),
    async complete(request) {
      return {
        text: '{"ok":true}',
        usage: { inputTokens: 4, outputTokens: 2 },
        requestId: request.modelOverride,
      };
    },
    health() {
      return { state: "closed", consecutiveFailures: 0 };
    },
  };
}

function task(risk: "low" | "high") {
  return {
    taskId: `routing:${risk}`,
    capability: "classify" as const,
    prompt: {
      id: "routing",
      version: "v4",
      systemTemplate: "Return structured JSON.",
    },
    userInput: "public evidence",
    outputSchema: schema,
    schemaName: "routing_result",
    budget: {
      maxInputTokens: 100,
      maxOutputTokens: 20,
      maxCostUsd: 0.01,
    },
    risk,
  };
}

describe("V4 AI routing policy", () => {
  it("supports an explicitly enabled loopback local adapter without a key", () => {
    const configuration = resolveAiRuntimeConfiguration({
      AI_ENABLED: "true",
      AI_GLOBAL_KILL: "false",
      AI_PROVIDER_ORDER: "local",
      AI_LOCAL_ENABLED: "true",
      AI_LOCAL_ENDPOINT: "http://127.0.0.1:11434/v1/chat/completions",
      AI_LOCAL_MODEL: "operator-selected-local-model",
      AI_LOCAL_TIER: "free",
      AI_LOCAL_INPUT_USD_PER_MILLION_TOKENS: "0",
      AI_LOCAL_OUTPUT_USD_PER_MILLION_TOKENS: "0",
      AI_LOCAL_CAPABILITIES: "classify,summarize",
    });
    expect(configuration.providers[0]).toMatchObject({
      id: "local",
      apiKey: "",
      tier: "free",
      model: "operator-selected-local-model",
      endpoint: "http://127.0.0.1:11434/v1/chat/completions",
    });
  });

  it("rejects an unsafe plain-HTTP local endpoint", () => {
    expect(() =>
      resolveAiRuntimeConfiguration({
        AI_ENABLED: "true",
        AI_GLOBAL_KILL: "false",
        AI_PROVIDER_ORDER: "local",
        AI_LOCAL_ENABLED: "true",
        AI_LOCAL_ENDPOINT: "http://example.com/v1/chat/completions",
        AI_LOCAL_MODEL: "model",
        AI_LOCAL_INPUT_USD_PER_MILLION_TOKENS: "0",
        AI_LOCAL_OUTPUT_USD_PER_MILLION_TOKENS: "0",
      }),
    ).toThrowError(
      expect.objectContaining({ code: "AI_CONFIGURATION_INVALID" }),
    );
  });

  it("keeps free and unknown tiers out of high-risk routes", async () => {
    const free = adapter("local", "free");
    const paid = adapter("openai", "paid");
    const gateway = new AiGateway({
      configuration: {
        enabled: true,
        globalKill: false,
        providerOrder: ["local", "openai"],
        providers: [],
      },
      providers: [free, paid],
    });
    const result = await gateway.execute(task("high"));
    expect(result.metadata.provider).toBe("openai");
    expect(result.metadata.attemptedProviders).toEqual(["openai"]);
  });

  it("passes capability-specific provider and model chains to the gateway", async () => {
    const execute = vi.fn(async () => ({
      data: { ok: true },
      metadata: {},
    }));
    const gateway = {
      execute,
      health: () => [],
    } as unknown as AiCapabilityGateway;
    const editorial = new EditorialAiGateway(gateway, {
      AI_CLASSIFICATION_CHAIN:
        "local:local-classifier-v2,openai:openai-classifier-v4",
      AI_PROVIDER_ORDER: "anthropic",
    });
    await editorial.classifyTrend({
      taskId: "classify:chain",
      content: { title: "Example" },
      budget: {
        maxInputTokens: 200,
        maxOutputTokens: 40,
        maxCostUsd: 0.01,
      },
    });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredProviders: ["local", "openai"],
        preferredModels: {
          local: "local-classifier-v2",
          openai: "openai-classifier-v4",
        },
        risk: "low",
        publicationMode: "assistive",
      }),
    );
  });

  it("enforces portfolio, story, task, context, revision, and concurrency limits", () => {
    const controls = resolveAiCostControls({
      AI_ENABLED: "true",
      AI_GLOBAL_KILL: "false",
      AI_MONTHLY_BUDGET_USD: "100",
      AI_PER_STORY_BUDGET_USD: "5",
      AI_PER_TASK_BUDGET_USD: "1",
      AI_MAX_CONTEXT_TOKENS: "10000",
      AI_MAX_OUTPUT_TOKENS: "2000",
      AI_MAX_REVISIONS: "3",
      AI_MAX_RETRIES: "2",
      AI_MAX_CONCURRENT_JOBS: "4",
    });
    const admission = new AiAdmissionController(controls);
    expect(() =>
      admission.authorize(
        {
          storyId: "story-1",
          revision: 4,
          estimatedInputTokens: 500,
          taskBudget: {
            maxInputTokens: 1_000,
            maxOutputTokens: 100,
            maxCostUsd: 0.5,
          },
        },
        { monthlySpendUsd: 1, storySpendUsd: 1, activeJobs: 0 },
      ),
    ).toThrowError(expect.objectContaining({ code: "AI_BUDGET_EXCEEDED" }));
  });
});
