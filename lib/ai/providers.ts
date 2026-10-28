import { runtimeFetch } from "../runtime/fetch";
import type { AiProviderConfiguration } from "./config";
import { AiRuntimeError } from "./errors";
import {
  CircuitBreaker,
  combineAbortSignals,
  executeWithResilience,
} from "./resilience";
import type { Clock, Sleeper } from "./resilience";
import type {
  AiProviderAdapter,
  AiProviderRequest,
  AiProviderResponse,
  AiUsage,
} from "./types";

export interface AiProviderDependencies {
  readonly fetchImpl?: typeof fetch;
  readonly clock?: Clock;
  readonly sleeper?: Sleeper;
}

abstract class HttpAiProviderAdapter implements AiProviderAdapter {
  readonly id;
  readonly model;
  readonly pricing;
  readonly capabilities;
  readonly tier;
  protected readonly fetchImpl;
  protected readonly circuit;

  constructor(
    protected readonly configuration: AiProviderConfiguration,
    protected readonly dependencies: AiProviderDependencies = {},
  ) {
    this.id = configuration.id;
    this.model = configuration.model;
    this.pricing = configuration.pricing;
    this.capabilities = configuration.capabilities;
    this.tier = configuration.tier;
    this.fetchImpl = dependencies.fetchImpl ?? runtimeFetch;
    this.circuit = new CircuitBreaker(
      configuration.circuitFailureThreshold,
      configuration.circuitCooldownMs,
      dependencies.clock,
    );
  }

  abstract complete(request: AiProviderRequest): Promise<AiProviderResponse>;

  health() {
    return this.circuit.snapshot();
  }

  protected async requestJson(
    url: string,
    init: RequestInit,
    callerSignal?: AbortSignal,
  ): Promise<{ payload: unknown; requestId?: string }> {
    return executeWithResilience({
      circuit: this.circuit,
      attempts: this.configuration.retryAttempts,
      sleeper: this.dependencies.sleeper,
      operation: async () => {
        let response: Response;
        try {
          response = await this.fetchImpl(url, {
            ...init,
            redirect: "manual",
            signal: combineAbortSignals(
              this.configuration.timeoutMs,
              callerSignal,
            ),
          });
        } catch (error) {
          if (
            error instanceof DOMException &&
            (error.name === "TimeoutError" || error.name === "AbortError")
          ) {
            throw new AiRuntimeError(
              "AI_PROVIDER_TIMEOUT",
              "The AI provider request timed out.",
              true,
            );
          }
          throw new AiRuntimeError(
            "AI_PROVIDER_UNAVAILABLE",
            "The AI provider request failed.",
            true,
          );
        }
        if (!response.ok) {
          const detail = await redactedProviderErrorDetail(response);
          console.warn("ai_provider_http_error", {
            provider: this.id,
            model: this.model,
            status: response.status,
            detail,
          });
          const httpError = providerHttpError(response.status, response.headers, detail);
          httpError.provider = this.id;
          throw httpError;
        }
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          throw new AiRuntimeError(
            "AI_PROVIDER_RESPONSE_INVALID",
            "The AI provider returned an unreadable response.",
          );
        }
        return {
          payload,
          requestId:
            response.headers.get("x-request-id") ??
            response.headers.get("request-id") ??
            undefined,
        };
      },
    });
  }
}

export class OpenAiProviderAdapter extends HttpAiProviderAdapter {
  async complete(request: AiProviderRequest): Promise<AiProviderResponse> {
    const body: Record<string, unknown> = {
      model: request.modelOverride ?? this.model,
      instructions: request.systemPrompt,
      input: request.userPrompt,
      max_output_tokens: request.maxOutputTokens,
    };
    if (request.temperature > 0) body.temperature = request.temperature;
    if (request.jsonSchema) {
      body.text = {
        format: {
          type: "json_schema",
          name: request.schemaName,
          schema: request.jsonSchema,
          strict: true,
        },
      };
    }
    const response = await this.requestJson(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.configuration.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
      request.signal,
    );
    const payload = asRecord(response.payload);
    const text =
      stringValue(payload.output_text) ??
      nestedOpenAiOutputText(payload.output) ??
      invalidProviderResponse();
    const usageRecord = asOptionalRecord(payload.usage);
    return {
      text,
      usage: normalizeUsage(
        usageRecord?.input_tokens,
        usageRecord?.output_tokens,
      ),
      requestId: response.requestId ?? stringValue(payload.id),
    };
  }
}

export class AnthropicProviderAdapter extends HttpAiProviderAdapter {
  async complete(request: AiProviderRequest): Promise<AiProviderResponse> {
    const webSearchEnabled = this.webSearchAllowed(request);
    const structuredInstruction =
      request.jsonSchema && webSearchEnabled
        ? `\nReturn only one JSON document matching this JSON Schema:\n${JSON.stringify(request.jsonSchema)}`
        : "";
    const model = request.modelOverride ?? this.model;
    const body: Record<string, unknown> = {
      model,
      system: `${request.systemPrompt}${structuredInstruction}${
        webSearchEnabled
          ? "\nUse web search only for current facts. Prefer primary sources, preserve exact HTTPS source URLs in the requested output, distinguish verified facts from uncertainty, and never treat search snippets as proof. Stop searching once the minimum source mix is satisfied."
          : ""
      }`,
      messages: [{ role: "user", content: request.userPrompt }],
      max_tokens: request.maxOutputTokens,
      stream: true,
    };
    if (!model.startsWith("claude-sonnet-5") && request.temperature > 0) {
      body.temperature = request.temperature;
    }
    if (request.jsonSchema && !webSearchEnabled) {
      body.output_config = {
        format: {
          type: "json_schema",
          schema: request.jsonSchema,
        },
      };
    }
    if (webSearchEnabled) {
      const search = this.configuration.webSearch!;
      const tool: Record<string, unknown> = {
        type: "web_search_20260318",
        name: "web_search",
        max_uses: Math.min(2, search.maxUses),
        allowed_callers: ["direct"],
      };
      if (search.allowedDomains.length > 0) {
        tool.allowed_domains = search.allowedDomains;
      } else if (search.blockedDomains.length > 0) {
        tool.blocked_domains = search.blockedDomains;
      }
      body.tools = [tool];
    }

    const response = await this.requestAnthropicMessage(
      body,
      request.signal,
    );
    const payload = asRecord(response.payload);
    const content = Array.isArray(payload.content) ? payload.content : [];
    const textBlocks = content
      .map(asOptionalRecord)
      .filter((entry) => entry?.type === "text" && typeof entry.text === "string");
    const narrative = textBlocks
      .map((entry) => String(entry?.text ?? "").trim())
      .filter(Boolean)
      .join("\n");
    const citations = extractAnthropicCitations(textBlocks);
    const text = [
      narrative,
      citations.length ? formatSourceAppendix(citations) : "",
    ]
      .filter(Boolean)
      .join("\n\n") || invalidProviderResponse();
    const usageRecord = asOptionalRecord(payload.usage);
    const inputTokens = anthropicInputTokens(usageRecord);
    return {
      text,
      usage: normalizeUsage(inputTokens, usageRecord?.output_tokens),
      requestId: response.requestId ?? stringValue(payload.id),
      groundedSourceUrls: citations.map((citation) => citation.url),
      groundingSearchQueries: [],
    };
  }

  private webSearchAllowed(request: AiProviderRequest): boolean {
    return Boolean(
      this.configuration.webSearch?.enabled &&
        new Set(["research_synthesis", "summarize", "fact_review"]).has(
          request.capability,
        ),
    );
  }

  private async requestAnthropicMessage(
    body: Record<string, unknown>,
    callerSignal?: AbortSignal,
  ): Promise<{ payload: unknown; requestId?: string }> {
    return executeWithResilience({
      circuit: this.circuit,
      attempts: 1,
      sleeper: this.dependencies.sleeper,
      operation: async () => {
        let response: Response;
        try {
          response = await this.fetchImpl("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": this.configuration.apiKey,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify(body),
            redirect: "manual",
            signal: combineAbortSignals(
              this.configuration.timeoutMs,
              callerSignal,
            ),
          });
        } catch (error) {
          if (
            error instanceof DOMException &&
            (error.name === "TimeoutError" || error.name === "AbortError")
          ) {
            throw new AiRuntimeError(
              "AI_PROVIDER_TIMEOUT",
              "The AI provider request timed out. The request was not retried to prevent duplicate billing.",
            );
          }
          throw new AiRuntimeError(
            "AI_PROVIDER_UNAVAILABLE",
            "The AI provider request failed.",
            true,
          );
        }
        if (!response.ok) {
          // The provider's own error text is the only thing that says *why* a
          // 400 was rejected - wrong model id, unsupported parameter, credit
          // exhausted. Without it every rejection read as an opaque "rejected
          // the request" and the fact reviewer looked dead for no visible
          // reason. Captured (key strings redacted) into both the log and the
          // error so it reaches the article's factReviewError.
          const detail = await redactedProviderErrorDetail(response);
          console.warn("ai_provider_http_error", {
            provider: this.id,
            model: this.model,
            status: response.status,
            detail,
          });
          const httpError = providerHttpError(response.status, response.headers, detail);
          httpError.provider = this.id;
          if (detail) httpError.message = `${httpError.message} Provider said: ${detail}`;
          throw httpError;
        }
        const requestId =
          response.headers.get("request-id") ??
          response.headers.get("x-request-id") ??
          undefined;
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().includes("text/event-stream")) {
          try {
            return { payload: await response.json(), requestId };
          } catch {
            throw new AiRuntimeError(
              "AI_PROVIDER_RESPONSE_INVALID",
              "The AI provider returned an unreadable response.",
            );
          }
        }
        if (!response.body) {
          throw new AiRuntimeError(
            "AI_PROVIDER_RESPONSE_INVALID",
            "The AI provider returned an empty stream.",
          );
        }
        return {
          payload: await readAnthropicEventStream(response.body),
          requestId,
        };
      },
    });
  }
}

export class GoogleProviderAdapter extends HttpAiProviderAdapter {
  async complete(request: AiProviderRequest): Promise<AiProviderResponse> {
    const searchGroundingEnabled = Boolean(
      this.configuration.webSearch?.enabled &&
        new Set(["research_synthesis", "fact_review", "summarize"]).has(
          request.capability,
        ),
    );
    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: request.maxOutputTokens,
      temperature: request.temperature,
    };
    const thinking = this.configuration.thinking;
    if (thinking?.level) {
      generationConfig.thinkingLevel = thinking.level;
    }
    if (typeof thinking?.budget === "number") {
      generationConfig.thinkingConfig = { thinkingBudget: thinking.budget };
    }
    if (request.jsonSchema) {
      generationConfig.responseMimeType = "application/json";
      generationConfig.responseJsonSchema = toGoogleJsonSchema(
        request.jsonSchema,
      );
    }
    const body: Record<string, unknown> = {
      systemInstruction: {
        parts: [
          {
            text: `${request.systemPrompt}${
              searchGroundingEnabled
                ? " Independently use Google Search grounding for current facts. Do not trust the supplied draft or source summaries as proof. Search for corroboration, prefer primary sources, and return schema-valid JSON."
                : ""
            }`,
          },
        ],
      },
      contents: [{ role: "user", parts: [{ text: request.userPrompt }] }],
      generationConfig,
    };
    if (searchGroundingEnabled) {
      body.tools = [{ googleSearch: {} }];
    }
    const response = await this.requestJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.modelOverride ?? this.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": this.configuration.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
      request.signal,
    );
    const payload = asRecord(response.payload);
    const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
    const candidate = asOptionalRecord(candidates[0]);
    const content = asOptionalRecord(candidate?.content);
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    const textPart = parts
      .map(asOptionalRecord)
      .find((entry) => typeof entry?.text === "string");
    const text = stringValue(textPart?.text) ?? invalidProviderResponse();
    const usageRecord = asOptionalRecord(payload.usageMetadata);
    const grounding = googleGroundingMetadata(candidate);
    return {
      text,
      usage: normalizeUsage(
        usageRecord?.promptTokenCount,
        usageRecord?.candidatesTokenCount,
      ),
      requestId: response.requestId,
      groundedSourceUrls: grounding.urls,
      groundingSearchQueries: grounding.queries,
    };
  }
}

/**
 * Gemini accepts only a subset of JSON Schema and answers anything else with a
 * bare `400 INVALID_ARGUMENT`. The editorial schemas are generated from Zod and
 * carry `$schema`, `additionalProperties`, `format`, `pattern` and length or
 * item bounds, so they are reduced to the accepted keywords here. Dropping the
 * constraints is safe because every provider response is still parsed and fully
 * validated against the original Zod schema before it is used.
 */
const GOOGLE_SCHEMA_KEYWORDS = new Set([
  "type",
  "title",
  "description",
  "properties",
  "required",
  "enum",
  "items",
  "minimum",
  "maximum",
  "anyOf",
  "nullable",
  "propertyOrdering",
]);

/**
 * Array bounds, string bounds, regular expressions and `format: uri` are outside
 * the keyword set Gemini accepts - sending them returns a bare
 * `400 INVALID_ARGUMENT` - but the Zod contract still enforces them on the
 * response. They are restated in the field description so the model is told the
 * rule it has to satisfy instead of silently losing it.
 */
function googleSchemaDescription(
  source: Record<string, unknown>,
): string | undefined {
  const hints: string[] = [];

  if (typeof source.minItems === "number") {
    hints.push(`an array of at least ${source.minItems} items`);
  }
  if (typeof source.maxItems === "number") {
    hints.push(`an array of at most ${source.maxItems} items`);
  }
  if (typeof source.minLength === "number") {
    hints.push(`at least ${source.minLength} characters`);
  }
  if (typeof source.maxLength === "number") {
    hints.push(`at most ${source.maxLength} characters`);
  }
  if (source.format === "uri" || source.format === "url") {
    hints.push("a complete absolute URL");
  }
  if (typeof source.pattern === "string") {
    hints.push(`matching the regular expression ${source.pattern}`);
  }

  const existing =
    typeof source.description === "string" ? source.description.trim() : "";

  if (hints.length === 0) return existing || undefined;

  return `${existing} Must be ${hints.join(", ")}.`.trim();
}

export function toGoogleJsonSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map((entry) => toGoogleJsonSchema(entry));
  }
  if (!schema || typeof schema !== "object") return schema;

  const source = schema as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (!GOOGLE_SCHEMA_KEYWORDS.has(key)) continue;

    if (key === "properties" && value && typeof value === "object") {
      const properties: Record<string, unknown> = {};
      for (const [name, entry] of Object.entries(
        value as Record<string, unknown>,
      )) {
        properties[name] = toGoogleJsonSchema(entry);
      }
      result[key] = properties;
      continue;
    }

    if (key === "required" || key === "enum" || key === "description") {
      result[key] = value;
      continue;
    }

    result[key] = toGoogleJsonSchema(value);
  }

  const description = googleSchemaDescription(source);

  if (description) {
    result.description = description;
  }

  return result;
}

function googleGroundingMetadata(
  candidate: Record<string, unknown> | undefined,
): { urls: string[]; queries: string[] } {
  const metadata = asOptionalRecord(candidate?.groundingMetadata);
  const chunks = Array.isArray(metadata?.groundingChunks)
    ? metadata.groundingChunks
    : [];
  const urls = chunks.flatMap((chunk) => {
    const web = asOptionalRecord(asOptionalRecord(chunk)?.web);
    const uri = stringValue(web?.uri);
    return uri && /^https:\/\//iu.test(uri) ? [uri] : [];
  });
  const queries = Array.isArray(metadata?.webSearchQueries)
    ? metadata.webSearchQueries
        .filter((query): query is string => typeof query === "string")
        .map((query) => query.trim())
        .filter(Boolean)
    : [];
  return {
    urls: Array.from(new Set(urls)).slice(0, 30),
    queries: Array.from(new Set(queries)).slice(0, 20),
  };
}

/**
 * Optional OpenAI-compatible local runtime. The endpoint is supplied in full
 * by the operator and is restricted to HTTPS or a loopback HTTP address by
 * configuration validation. It never participates unless explicitly enabled.
 */
export class LocalAiProviderAdapter extends HttpAiProviderAdapter {
  async complete(request: AiProviderRequest): Promise<AiProviderResponse> {
    const schemaInstruction = request.jsonSchema
      ? `\nReturn only one JSON document matching this JSON Schema:\n${JSON.stringify(request.jsonSchema)}`
      : "";
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (this.configuration.apiKey) {
      headers.authorization = `Bearer ${this.configuration.apiKey}`;
    }
    const response = await this.requestJson(
      this.configuration.endpoint!,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: request.modelOverride ?? this.model,
          messages: [
            {
              role: "system",
              content: `${request.systemPrompt}${schemaInstruction}`,
            },
            { role: "user", content: request.userPrompt },
          ],
          max_tokens: request.maxOutputTokens,
          temperature: request.temperature,
        }),
      },
      request.signal,
    );
    const payload = asRecord(response.payload);
    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const firstChoice = asOptionalRecord(choices[0]);
    const message = asOptionalRecord(firstChoice?.message);
    const usage = asOptionalRecord(payload.usage);
    return {
      text:
        stringValue(message?.content) ??
        stringValue(payload.output_text) ??
        invalidProviderResponse(),
      usage: normalizeUsage(
        usage?.prompt_tokens ?? usage?.input_tokens,
        usage?.completion_tokens ?? usage?.output_tokens,
      ),
      requestId: response.requestId ?? stringValue(payload.id),
    };
  }
}

function anthropicInputTokens(
  usage: Record<string, unknown> | undefined,
): number {
  let total = 0;
  for (const value of [
    usage?.input_tokens,
    usage?.cache_creation_input_tokens,
    usage?.cache_read_input_tokens,
  ]) {
    total += safeTokenCount(value);
  }
  return total;
}

async function readAnthropicEventStream(
  stream: ReadableStream<Uint8Array>,
): Promise<Record<string, unknown>> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let narrative = "";
  let messageId: string | undefined;
  let inputTokens = 0;
  let cacheCreationInputTokens = 0;
  let cacheReadInputTokens = 0;
  let outputTokens = 0;
  const citations: Array<Record<string, unknown>> = [];

  const addCitation = (value: unknown) => {
    const citation = asOptionalRecord(value);
    const url = stringValue(citation?.url);
    if (!url || !/^https:\/\//iu.test(url)) return;
    citations.push({
      ...citation,
      title: stringValue(citation?.title) ?? new URL(url).hostname,
      url,
    });
  };

  const consume = (block: string) => {
    const dataLines = block
      .split(/\r?\n/u)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter((line) => line && line !== "[DONE]");
    for (const line of dataLines) {
      let event: Record<string, unknown>;
      try {
        event = asRecord(JSON.parse(line));
      } catch {
        continue;
      }
      if (event.type === "error") {
        const error = asOptionalRecord(event.error);
        throw new AiRuntimeError(
          "AI_PROVIDER_UNAVAILABLE",
          stringValue(error?.message) ?? "The AI provider stream failed.",
          true,
        );
      }
      if (event.type === "message_start") {
        const message = asOptionalRecord(event.message);
        const usage = asOptionalRecord(message?.usage);
        messageId = stringValue(message?.id) ?? messageId;
        inputTokens = safeTokenCount(usage?.input_tokens);
        cacheCreationInputTokens = safeTokenCount(
          usage?.cache_creation_input_tokens,
        );
        cacheReadInputTokens = safeTokenCount(usage?.cache_read_input_tokens);
      }
      if (event.type === "content_block_start") {
        const contentBlock = asOptionalRecord(event.content_block);
        if (contentBlock?.type === "text" && Array.isArray(contentBlock.citations)) {
          for (const citation of contentBlock.citations) addCitation(citation);
        }
        if (
          contentBlock?.type === "web_search_tool_result" &&
          Array.isArray(contentBlock.content)
        ) {
          for (const result of contentBlock.content) addCitation(result);
        }
      }
      if (event.type === "content_block_delta") {
        const delta = asOptionalRecord(event.delta);
        if (delta?.type === "text_delta" && typeof delta.text === "string") {
          narrative += delta.text;
        }
        if (delta?.type === "citations_delta") {
          addCitation(delta.citation);
        }
      }
      if (event.type === "message_delta") {
        const usage = asOptionalRecord(event.usage);
        outputTokens = Math.max(
          outputTokens,
          safeTokenCount(usage?.output_tokens),
        );
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !done });
      buffer = buffer.replaceAll("\r\n", "\n");
    }
    if (done) {
      buffer += decoder.decode();
    }
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      consume(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
    if (done) break;
  }
  if (buffer.trim()) consume(buffer);
  if (!narrative.trim()) {
    throw new AiRuntimeError(
      "AI_PROVIDER_RESPONSE_INVALID",
      "The AI provider stream completed without a text result.",
    );
  }
  return {
    id: messageId,
    content: [
      {
        type: "text",
        text: narrative,
        citations,
      },
    ],
    usage: {
      input_tokens: inputTokens,
      cache_creation_input_tokens: cacheCreationInputTokens,
      cache_read_input_tokens: cacheReadInputTokens,
      output_tokens: outputTokens,
    },
  };
}

function safeTokenCount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

function extractAnthropicCitations(
  blocks: readonly (Record<string, unknown> | undefined)[],
): readonly { title: string; url: string }[] {
  const citations: Array<{ title: string; url: string }> = [];
  for (const block of blocks) {
    if (!block || !Array.isArray(block.citations)) continue;
    for (const citation of block.citations) {
      const record = asOptionalRecord(citation);
      const url = stringValue(record?.url);
      if (!url || !/^https:\/\//iu.test(url)) continue;
      citations.push({
        title: stringValue(record?.title) ?? new URL(url).hostname,
        url,
      });
    }
  }
  return Array.from(
    new Map(citations.map((citation) => [citation.url, citation])).values(),
  ).slice(0, 20);
}

function formatSourceAppendix(
  citations: readonly { title: string; url: string }[],
): string {
  return `Sources consulted:
${citations
    .map((citation) => `- ${citation.title}: ${citation.url}`)
    .join("\n")}`;
}

export function createAiProviderAdapters(
  configurations: readonly AiProviderConfiguration[],
  dependencies: AiProviderDependencies = {},
): readonly AiProviderAdapter[] {
  return configurations.map((configuration) => {
    switch (configuration.id) {
      case "openai":
        return new OpenAiProviderAdapter(configuration, dependencies);
      case "anthropic":
        return new AnthropicProviderAdapter(configuration, dependencies);
      case "google":
        return new GoogleProviderAdapter(configuration, dependencies);
      case "local":
        return new LocalAiProviderAdapter(configuration, dependencies);
    }
  });
}

/**
 * Provider rejections are surfaced to callers as a generic code so that no
 * upstream body reaches the newsroom UI. Operators still need the real reason,
 * so a truncated, credential-redacted copy is written to the Worker log only.
 */
async function redactedProviderErrorDetail(response: Response): Promise<string> {
  let body: string;
  try {
    body = await response.text();
  } catch {
    return "unreadable error body";
  }

  return body
    .replaceAll(/(AIza|sk-(?:ant-)?)[A-Za-z0-9_-]{8,}/gu, "[redacted]")
    .replaceAll(/\s+/gu, " ")
    .trim()
    .slice(0, 400);
}

/**
 * `retry-after` is either a delay in seconds or an HTTP date. Anything longer
 * than the cap is not worth holding a queue message open for; the caller's
 * cooldown handles that case instead.
 */
function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header.trim());
  const milliseconds = Number.isFinite(seconds)
    ? seconds * 1_000
    : Date.parse(header) - Date.now();
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return undefined;
  return Math.min(milliseconds, 30_000);
}

/**
 * Gemini names the exhausted quota (`...PerDay...`) in the 429 body; other
 * providers say "daily" or "per day". A daily quota cannot recover within the
 * request or within an hour, so it is reported as such instead of being
 * retried against the same spent allowance all day.
 */
export function rateLimitQuotaScope(detail: string | undefined): "daily" | "short" {
  return detail && /PerDay|per[\s_-]?day|daily/iu.test(detail) ? "daily" : "short";
}

export function providerHttpError(
  status: number,
  headers?: Headers,
  detail?: string,
): AiRuntimeError {
  if (status === 408 || status === 504) {
    return new AiRuntimeError(
      "AI_PROVIDER_TIMEOUT",
      "The AI provider request timed out.",
    );
  }
  if (status === 429) {
    const quotaScope = rateLimitQuotaScope(detail);
    const rateLimited = new AiRuntimeError(
      "AI_PROVIDER_RATE_LIMITED",
      quotaScope === "daily"
        ? "The AI provider's daily quota is exhausted."
        : "The AI provider rate-limited the request.",
      quotaScope !== "daily",
    );
    rateLimited.quotaScope = quotaScope;
    rateLimited.retryAfterMs = parseRetryAfterMs(
      headers?.get("retry-after") ?? null,
    );
    return rateLimited;
  }
  if (status === 401 || status === 403) {
    return new AiRuntimeError(
      "AI_PROVIDER_INVALID_KEY",
      "The AI provider rejected its server credential.",
    );
  }
  if (status === 402) {
    return new AiRuntimeError(
      "AI_PROVIDER_NO_CREDIT",
      "The AI provider account has no available credit.",
    );
  }
  if (status === 404 || status === 410) {
    return new AiRuntimeError(
      "AI_PROVIDER_MODEL_UNAVAILABLE",
      "The configured AI model is unavailable.",
      true,
    );
  }
  if (status === 413) {
    return new AiRuntimeError(
      "AI_PROVIDER_CONTEXT_LIMIT",
      "The AI provider rejected the request context as too large.",
    );
  }
  if (status === 422) {
    return new AiRuntimeError(
      "AI_PROVIDER_BAD_OUTPUT",
      "The AI provider could not satisfy the structured output contract.",
    );
  }
  if (status === 451) {
    return new AiRuntimeError(
      "AI_PROVIDER_MODERATION_REJECTION",
      "The AI provider rejected the request under its safety policy.",
    );
  }
  if (status >= 500) {
    return new AiRuntimeError(
      "AI_PROVIDER_UNAVAILABLE",
      "The AI provider is temporarily unavailable.",
      true,
    );
  }
  return new AiRuntimeError(
    "AI_PROVIDER_REJECTED",
    "The AI provider rejected the request.",
  );
}

function normalizeUsage(input: unknown, output: unknown): AiUsage {
  if (
    typeof input !== "number" ||
    !Number.isSafeInteger(input) ||
    input < 0 ||
    typeof output !== "number" ||
    !Number.isSafeInteger(output) ||
    output < 0
  ) {
    invalidProviderResponse();
  }
  return { inputTokens: input, outputTokens: output };
}

function nestedOpenAiOutputText(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  for (const item of value) {
    const record = asOptionalRecord(item);
    if (!Array.isArray(record?.content)) continue;
    for (const content of record.content) {
      const part = asOptionalRecord(content);
      if (part?.type === "output_text" && typeof part.text === "string") {
        return part.text;
      }
    }
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  const record = asOptionalRecord(value);
  return record ?? invalidProviderResponse();
}

function asOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function invalidProviderResponse(): never {
  throw new AiRuntimeError(
    "AI_PROVIDER_RESPONSE_INVALID",
    "The AI provider response did not match the expected transport contract.",
  );
}
