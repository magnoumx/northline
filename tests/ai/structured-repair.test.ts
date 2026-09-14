import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AiGateway,
  parseStructuredOutput,
  type AiProviderAdapter,
  type AiProviderRequest,
} from "../../lib/ai";

const schema = z
  .object({
    ok: z.boolean(),
    source: z.string().url(),
  })
  .strict();

describe("structured output recovery", () => {
  it("accepts schema-valid JSON inside a Markdown fence", () => {
    expect(
      parseStructuredOutput(
        'Research complete.\n```json\n{"ok":true,"source":"https://example.gov/source"}\n```',
        schema,
      ),
    ).toEqual({ ok: true, source: "https://example.gov/source" });
  });

  it("accepts schema-valid JSON after brief prose and before a source appendix", () => {
    expect(
      parseStructuredOutput(
        'Completed research follows.\n{"ok":true,"source":"https://example.gov/source"}\n\nSources consulted:\n- https://example.gov/source',
        schema,
      ),
    ).toEqual({ ok: true, source: "https://example.gov/source" });
  });

  it("repairs an Anthropic research response with one non-search structured pass", async () => {
    const requests: AiProviderRequest[] = [];
    const provider: AiProviderAdapter = {
      id: "anthropic",
      model: "claude-test-model",
      tier: "paid",
      pricing: {
        inputUsdPerMillionTokens: 1,
        outputUsdPerMillionTokens: 1,
      },
      capabilities: new Set(["research_synthesis"]),
      async complete(request) {
        requests.push(request);
        if (request.capability === "research_synthesis") {
          return {
            text: "Research completed in prose with a cited source: https://example.gov/source",
            usage: { inputTokens: 100, outputTokens: 50 },
          };
        }
        return {
          text: '{"ok":true,"source":"https://example.gov/source"}',
          usage: { inputTokens: 50, outputTokens: 20 },
        };
      },
      health() {
        return { state: "closed", consecutiveFailures: 0 };
      },
    };

    const gateway = new AiGateway({
      configuration: {
        enabled: true,
        globalKill: false,
        providerOrder: ["anthropic"],
        providers: [],
      },
      providers: [provider],
    });

    const result = await gateway.execute({
      taskId: "research:structured-repair",
      capability: "research_synthesis",
      prompt: {
        id: "research-repair-test",
        version: "1",
        systemTemplate: "Research and return structured data.",
      },
      userInput: "Research the test topic.",
      outputSchema: schema,
      schemaName: "research_repair_test",
      budget: {
        maxInputTokens: 10_000,
        maxOutputTokens: 1_000,
        maxCostUsd: 1,
      },
      preferredProviders: ["anthropic"],
    });

    expect(result.data).toEqual({
      ok: true,
      source: "https://example.gov/source",
    });
    expect(requests.map((request) => request.capability)).toEqual([
      "research_synthesis",
      "extract",
    ]);
    expect(requests[1]?.jsonSchema).toBeDefined();
  });
});
