import { describe, expect, it, vi } from "vitest";
import {
  AnthropicProviderAdapter,
  GoogleProviderAdapter,
  OpenAiProviderAdapter,
  type AiProviderConfiguration,
  type AiProviderId,
} from "../../lib/ai";

function configuration(id: AiProviderId): AiProviderConfiguration {
  return {
    id,
    apiKey: `${id}-secret-key`,
    model: `${id}-environment-model`,
    tier: "paid",
    pricing: {
      inputUsdPerMillionTokens: 1,
      outputUsdPerMillionTokens: 2,
    },
    capabilities: new Set(["classify"]),
    timeoutMs: 1_000,
    retryAttempts: 2,
    circuitFailureThreshold: 2,
    circuitCooldownMs: 5_000,
  };
}

const request = {
  capability: "classify" as const,
  systemPrompt: "Return a classification.",
  userPrompt: "Source content",
  schemaName: "classification",
  jsonSchema: { type: "object" },
  maxOutputTokens: 100,
  temperature: 0,
};

describe("provider HTTP adapters", () => {
  it("uses the environment-selected OpenAI model and retries a rate limit", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "response-1",
            output_text: '{"ok":true}',
            usage: { input_tokens: 12, output_tokens: 4 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    const adapter = new OpenAiProviderAdapter(configuration("openai"), {
      fetchImpl: fetcher as unknown as typeof fetch,
      sleeper: async () => undefined,
    });
    const result = await adapter.complete(request);
    expect(result).toMatchObject({
      text: '{"ok":true}',
      usage: { inputTokens: 12, outputTokens: 4 },
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const body = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body));
    expect(body.model).toBe("openai-environment-model");
    expect(fetcher.mock.calls[1]?.[1]?.redirect).toBe("manual");
  });

  it("maps Anthropic text and usage without exposing errors bodies", async () => {
    let capturedBody = "";
    const fetcher: typeof fetch = async (_input, init) => {
      capturedBody = String(init?.body);
      return new Response(
        JSON.stringify({
          id: "message-1",
          content: [{ type: "text", text: '{"ok":true}' }],
          usage: { input_tokens: 8, output_tokens: 3 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const adapter = new AnthropicProviderAdapter(
      configuration("anthropic"),
      { fetchImpl: fetcher },
    );
    expect(await adapter.complete(request)).toMatchObject({
      text: '{"ok":true}',
      usage: { inputTokens: 8, outputTokens: 3 },
    });
    const body = JSON.parse(capturedBody);
    expect(body.model).toBe("anthropic-environment-model");
  });

  it("enables bounded Anthropic web search for research tasks and omits Sonnet 5 sampling parameters", async () => {
    let capturedBody: Record<string, unknown> = {};
    const config: AiProviderConfiguration = {
      ...configuration("anthropic"),
      model: "claude-sonnet-5",
      capabilities: new Set(["research_synthesis"]),
      webSearch: {
        enabled: true,
        maxUses: 3,
        allowedDomains: [],
        blockedDomains: ["example-spam.test"],
      },
    };
    const adapter = new AnthropicProviderAdapter(config, {
      fetchImpl: async (_input, init) => {
        capturedBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            id: "message-search",
            content: [
              {
                type: "text",
                text: '{"ok":true}',
                citations: [
                  {
                    type: "web_search_result_location",
                    title: "Primary source",
                    url: "https://example.gov/source",
                  },
                ],
              },
            ],
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });
    const result = await adapter.complete({
      ...request,
      capability: "research_synthesis",
      temperature: 0.2,
    });
    expect(result.text).toContain("https://example.gov/source");
    expect(capturedBody.temperature).toBeUndefined();
    expect(capturedBody.tools).toMatchObject([
      {
        type: "web_search_20260318",
        name: "web_search",
        max_uses: 2,
        blocked_domains: ["example-spam.test"],
      },
    ]);
  });

  it("maps Google content and token metadata with the API key in a header", async () => {
    let capturedUrl = "";
    let capturedHeaders: HeadersInit | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedHeaders = init?.headers;
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
          usageMetadata: {
            promptTokenCount: 9,
            candidatesTokenCount: 5,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const adapter = new GoogleProviderAdapter(configuration("google"), {
      fetchImpl: fetcher,
    });
    expect(await adapter.complete(request)).toMatchObject({
      text: '{"ok":true}',
      usage: { inputTokens: 9, outputTokens: 5 },
    });
    expect(capturedUrl).toContain("google-environment-model");
    expect(capturedUrl).not.toContain("google-secret-key");
    expect(capturedHeaders).toMatchObject({
      "x-goog-api-key": "google-secret-key",
    });
  });
  it("grounds Gemini fact review with Google Search and reports grounding metadata", async () => {
    let capturedBody: Record<string, unknown> = {};
    const config: AiProviderConfiguration = {
      ...configuration("google"),
      capabilities: new Set(["fact_review"]),
      webSearch: {
        enabled: true,
        maxUses: 1,
        allowedDomains: [],
        blockedDomains: [],
      },
    };
    const adapter = new GoogleProviderAdapter(config, {
      fetchImpl: async (_input, init) => {
        capturedBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: '{"findings":[],"blocking":false}' }] },
                groundingMetadata: {
                  webSearchQueries: ["official match result"],
                  groundingChunks: [
                    { web: { uri: "https://example.gov/result", title: "Official result" } },
                  ],
                },
              },
            ],
            usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 7 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });
    const result = await adapter.complete({
      ...request,
      capability: "fact_review",
    });
    expect(capturedBody.tools).toEqual([{ googleSearch: {} }]);
    expect(result.groundedSourceUrls).toEqual(["https://example.gov/result"]);
    expect(result.groundingSearchQueries).toEqual(["official match result"]);
  });

});
