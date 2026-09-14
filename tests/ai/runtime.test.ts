import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  AiGateway,
  AiRuntimeError,
  fingerprintPrompt,
  parseStructuredOutput,
  resolveAiRuntimeConfiguration,
  type AiProviderAdapter,
  type AiProviderId,
} from "../../lib/ai";

const outputSchema = z.object({
  label: z.enum(["news", "opinion"]),
  confidence: z.number().min(0).max(1),
});

function provider(
  id: AiProviderId,
  text: string,
  onRequest?: (userPrompt: string) => void,
): AiProviderAdapter {
  return {
    id,
    model: `${id}-configured-model`,
    tier: "paid",
    pricing: {
      inputUsdPerMillionTokens: 1,
      outputUsdPerMillionTokens: 2,
    },
    capabilities: new Set(["classify"]),
    async complete(request) {
      onRequest?.(request.userPrompt);
      return {
        text,
        usage: { inputTokens: 20, outputTokens: 10 },
      };
    },
    health() {
      return { state: "closed", consecutiveFailures: 0 };
    },
  };
}

function operationalConfiguration() {
  return {
    enabled: true,
    globalKill: false,
    providerOrder: ["openai", "anthropic", "google"] as const,
    providers: [],
  };
}

function task() {
  return {
    taskId: "candidate:123:classify",
    capability: "classify" as const,
    prompt: {
      id: "candidate-classifier",
      version: "1.0.0",
      systemTemplate: "Classify the supplied source material.",
    },
    userInput: "API_KEY=should-not-leave-the-boundary source material",
    outputSchema,
    schemaName: "candidate-classification",
    budget: {
      maxInputTokens: 1_000,
      maxOutputTokens: 100,
      maxCostUsd: 0.01,
    },
  };
}

describe("AI runtime configuration and contracts", () => {
  it("is disabled with its kill switch active by default", () => {
    expect(resolveAiRuntimeConfiguration({})).toMatchObject({
      enabled: false,
      globalKill: true,
      providers: [],
    });
  });

  it("fails closed when AI is activated without a fully configured provider", () => {
    expect(() =>
      resolveAiRuntimeConfiguration({
        AI_ENABLED: "true",
        AI_GLOBAL_KILL: "false",
      }),
    ).toThrowError(
      expect.objectContaining({ code: "AI_CONFIGURATION_INVALID" }),
    );
  });

  it("requires environment model names and prices for an enabled provider", () => {
    const configuration = resolveAiRuntimeConfiguration({
      AI_ENABLED: "true",
      AI_GLOBAL_KILL: "false",
      AI_OPENAI_ENABLED: "true",
      OPENAI_API_KEY: "test-only",
      AI_OPENAI_MODEL: "environment-selected-model",
      AI_OPENAI_INPUT_USD_PER_MILLION_TOKENS: "2.5",
      AI_OPENAI_OUTPUT_USD_PER_MILLION_TOKENS: "15",
    });
    expect(configuration.providers[0]).toMatchObject({
      id: "openai",
      model: "environment-selected-model",
      pricing: {
        inputUsdPerMillionTokens: 2.5,
        outputUsdPerMillionTokens: 15,
      },
    });
  });

  it("fingerprints prompt versions deterministically without task content", async () => {
    const first = await fingerprintPrompt(task().prompt, task().schemaName);
    const second = await fingerprintPrompt(task().prompt, task().schemaName);
    const changed = await fingerprintPrompt(
      { ...task().prompt, version: "1.0.1" },
      task().schemaName,
    );
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(second).toBe(first);
    expect(changed).not.toBe(first);
  });

  it("rejects JSON that does not satisfy the Zod output contract", () => {
    expect(() =>
      parseStructuredOutput(
        '{"label":"fabricated","confidence":2}',
        outputSchema,
      ),
    ).toThrowError(
      expect.objectContaining({ code: "AI_STRUCTURED_OUTPUT_INVALID" }),
    );
  });
});

describe("capability gateway", () => {
  it("falls back after invalid structured output and returns audited usage", async () => {
    const gateway = new AiGateway({
      configuration: operationalConfiguration(),
      providers: [
        provider("openai", "not-json"),
        provider(
          "anthropic",
          JSON.stringify({ label: "news", confidence: 0.91 }),
        ),
      ],
    });
    const result = await gateway.execute(task());
    expect(result.data).toEqual({ label: "news", confidence: 0.91 });
    expect(result.metadata).toMatchObject({
      provider: "anthropic",
      attemptedProviders: ["openai", "anthropic"],
      promptId: "candidate-classifier",
      promptVersion: "1.0.0",
    });
    expect(result.metadata.costUsd).toBeGreaterThan(0);
  });

  it("redacts secret-like input and never places prompts in structured logs", async () => {
    let transmitted = "";
    const logger = vi.fn();
    const gateway = new AiGateway({
      configuration: operationalConfiguration(),
      providers: [
        provider(
          "openai",
          JSON.stringify({ label: "news", confidence: 0.8 }),
          (userPrompt) => {
            transmitted = userPrompt;
          },
        ),
      ],
      logger,
    });
    await gateway.execute(task());
    expect(transmitted).toContain("API_KEY=[REDACTED]");
    expect(JSON.stringify(logger.mock.calls)).not.toContain(
      "should-not-leave-the-boundary",
    );
    expect(JSON.stringify(logger.mock.calls)).not.toContain(
      "Classify the supplied source material.",
    );
  });

  it("enforces the global kill switch before calling a provider", async () => {
    const complete = vi.fn();
    const disabledProvider = provider(
      "openai",
      JSON.stringify({ label: "news", confidence: 1 }),
    );
    disabledProvider.complete = complete;
    const gateway = new AiGateway({
      configuration: {
        ...operationalConfiguration(),
        globalKill: true,
      },
      providers: [disabledProvider],
    });
    await expect(gateway.execute(task())).rejects.toBeInstanceOf(
      AiRuntimeError,
    );
    await expect(gateway.execute(task())).rejects.toMatchObject({
      code: "AI_KILL_SWITCH_ACTIVE",
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it("refuses providers whose worst-case task cost exceeds budget", async () => {
    const expensive: AiProviderAdapter = {
      ...provider(
        "openai",
        JSON.stringify({ label: "news", confidence: 1 }),
      ),
      pricing: {
        inputUsdPerMillionTokens: 10_000,
        outputUsdPerMillionTokens: 10_000,
      },
    };
    const gateway = new AiGateway({
      configuration: operationalConfiguration(),
      providers: [expensive],
    });
    await expect(gateway.execute(task())).rejects.toMatchObject({
      code: "AI_NO_PROVIDER_AVAILABLE",
    });
  });
});
