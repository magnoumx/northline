import { AI_CAPABILITIES, AI_PROVIDERS } from "./types";
import type {
  AiCapability,
  AiPricing,
  AiProviderId,
  AiProviderTier,
} from "./types";
import { AiRuntimeError } from "./errors";

export type AiEnvironment = Record<string, string | undefined>;

export interface AiProviderConfiguration {
  readonly id: AiProviderId;
  readonly apiKey: string;
  readonly model: string;
  readonly endpoint?: string;
  readonly tier: AiProviderTier;
  readonly pricing: AiPricing;
  readonly capabilities: ReadonlySet<AiCapability>;
  readonly timeoutMs: number;
  readonly retryAttempts: number;
  readonly circuitFailureThreshold: number;
  readonly circuitCooldownMs: number;
  readonly webSearch?: {
    readonly enabled: boolean;
    readonly maxUses: number;
    readonly allowedDomains: readonly string[];
    readonly blockedDomains: readonly string[];
  };
  /**
   * Optional reasoning controls. Model families disagree on the field name, so
   * each value is only sent when an operator has explicitly configured it after
   * validating that the selected model accepts it.
   */
  readonly thinking?: {
    readonly level?: string;
    readonly budget?: number;
  };
}

export interface AiRuntimeConfiguration {
  readonly enabled: boolean;
  readonly globalKill: boolean;
  readonly providerOrder: readonly AiProviderId[];
  readonly providers: readonly AiProviderConfiguration[];
}

const providerKeys: Record<
  AiProviderId,
  {
    enabled: string;
    apiKey: string;
    model: string;
    inputPrice: string;
    outputPrice: string;
    capabilities: string;
    tier: string;
    endpoint?: string;
  }
> = {
  openai: {
    enabled: "AI_OPENAI_ENABLED",
    apiKey: "OPENAI_API_KEY",
    model: "AI_OPENAI_MODEL",
    inputPrice: "AI_OPENAI_INPUT_USD_PER_MILLION_TOKENS",
    outputPrice: "AI_OPENAI_OUTPUT_USD_PER_MILLION_TOKENS",
    capabilities: "AI_OPENAI_CAPABILITIES",
    tier: "AI_OPENAI_TIER",
  },
  anthropic: {
    enabled: "AI_ANTHROPIC_ENABLED",
    apiKey: "ANTHROPIC_API_KEY",
    model: "AI_ANTHROPIC_MODEL",
    inputPrice: "AI_ANTHROPIC_INPUT_USD_PER_MILLION_TOKENS",
    outputPrice: "AI_ANTHROPIC_OUTPUT_USD_PER_MILLION_TOKENS",
    capabilities: "AI_ANTHROPIC_CAPABILITIES",
    tier: "AI_ANTHROPIC_TIER",
  },
  google: {
    enabled: "AI_GOOGLE_ENABLED",
    apiKey: "GOOGLE_AI_API_KEY",
    model: "AI_GOOGLE_MODEL",
    inputPrice: "AI_GOOGLE_INPUT_USD_PER_MILLION_TOKENS",
    outputPrice: "AI_GOOGLE_OUTPUT_USD_PER_MILLION_TOKENS",
    capabilities: "AI_GOOGLE_CAPABILITIES",
    tier: "AI_GOOGLE_TIER",
  },
  local: {
    enabled: "AI_LOCAL_ENABLED",
    apiKey: "AI_LOCAL_API_KEY",
    model: "AI_LOCAL_MODEL",
    inputPrice: "AI_LOCAL_INPUT_USD_PER_MILLION_TOKENS",
    outputPrice: "AI_LOCAL_OUTPUT_USD_PER_MILLION_TOKENS",
    capabilities: "AI_LOCAL_CAPABILITIES",
    tier: "AI_LOCAL_TIER",
    endpoint: "AI_LOCAL_ENDPOINT",
  },
};

export function resolveAiRuntimeConfiguration(
  environment: AiEnvironment = process.env,
): AiRuntimeConfiguration {
  const enabled = environment.AI_ENABLED === "true";
  const globalKill = environment.AI_GLOBAL_KILL !== "false";
  const providerOrder = parseProviderOrder(environment.AI_PROVIDER_ORDER);

  if (!enabled || globalKill) {
    return { enabled, globalKill, providerOrder, providers: [] };
  }

  const timeoutMs = boundedInteger(
    environment.AI_PROVIDER_TIMEOUT_MS,
    8_000,
    1_000,
    300_000,
    "AI_PROVIDER_TIMEOUT_MS",
  );
  const retryAttempts = boundedInteger(
    environment.AI_PROVIDER_RETRY_ATTEMPTS,
    2,
    1,
    4,
    "AI_PROVIDER_RETRY_ATTEMPTS",
  );
  const circuitFailureThreshold = boundedInteger(
    environment.AI_CIRCUIT_FAILURE_THRESHOLD,
    3,
    1,
    20,
    "AI_CIRCUIT_FAILURE_THRESHOLD",
  );
  const circuitCooldownMs = boundedInteger(
    environment.AI_CIRCUIT_COOLDOWN_MS,
    30_000,
    1_000,
    900_000,
    "AI_CIRCUIT_COOLDOWN_MS",
  );

  const providers = providerOrder.flatMap((id) => {
    const keys = providerKeys[id];
    if (environment[keys.enabled] !== "true") return [];
    const apiKey =
      id === "local"
        ? environment[keys.apiKey]?.trim() ?? ""
        : requiredValue(environment, keys.apiKey);
    const model = requiredValue(environment, keys.model);
    const endpoint =
      id === "local"
        ? safeLocalEndpoint(requiredValue(environment, keys.endpoint!))
        : undefined;
    const pricing = {
      inputUsdPerMillionTokens: nonNegativeNumber(
        environment[keys.inputPrice],
        keys.inputPrice,
      ),
      outputUsdPerMillionTokens: nonNegativeNumber(
        environment[keys.outputPrice],
        keys.outputPrice,
      ),
    };
    return [
      {
        id,
        apiKey,
        model,
        endpoint,
        tier: providerTier(environment[keys.tier]),
        pricing,
        capabilities: parseCapabilities(environment[keys.capabilities]),
        timeoutMs,
        retryAttempts,
        circuitFailureThreshold,
        circuitCooldownMs,
        ...(id === "anthropic"
          ? {
              webSearch: {
                enabled:
                  environment.AI_ANTHROPIC_WEB_SEARCH_ENABLED === "true",
                maxUses: boundedInteger(
                  environment.AI_ANTHROPIC_WEB_SEARCH_MAX_USES,
                  3,
                  1,
                  10,
                  "AI_ANTHROPIC_WEB_SEARCH_MAX_USES",
                ),
                allowedDomains: domainList(
                  environment.AI_ANTHROPIC_WEB_SEARCH_ALLOWED_DOMAINS,
                ),
                blockedDomains: domainList(
                  environment.AI_ANTHROPIC_WEB_SEARCH_BLOCKED_DOMAINS,
                ),
              },
            }
          : id === "google"
            ? {
                webSearch: {
                  enabled:
                    environment.AI_GOOGLE_SEARCH_GROUNDING_ENABLED === "true",
                  maxUses: 1,
                  allowedDomains: [],
                  blockedDomains: [],
                },
                thinking: googleThinkingControls(environment),
              }
            : {}),
      },
    ];
  });

  if (providers.length === 0) {
    throw new AiRuntimeError(
      "AI_CONFIGURATION_INVALID",
      "AI is enabled but no provider is explicitly enabled and fully configured.",
    );
  }

  return { enabled, globalKill, providerOrder, providers };
}

function parseProviderOrder(value: string | undefined): readonly AiProviderId[] {
  const requested = (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry): entry is AiProviderId =>
      AI_PROVIDERS.includes(entry as AiProviderId),
    );
  return Array.from(new Set([...requested, ...AI_PROVIDERS]));
}

function parseCapabilities(value: string | undefined): ReadonlySet<AiCapability> {
  if (!value?.trim()) return new Set(AI_CAPABILITIES);
  const requested = value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry): entry is AiCapability =>
      AI_CAPABILITIES.includes(entry as AiCapability),
    );
  if (requested.length === 0) {
    throw new AiRuntimeError(
      "AI_CONFIGURATION_INVALID",
      "An enabled AI provider has no valid configured capabilities.",
    );
  }
  return new Set(requested);
}

function requiredValue(environment: AiEnvironment, key: string): string {
  const value = environment[key]?.trim();
  if (!value) {
    throw new AiRuntimeError(
      "AI_CONFIGURATION_INVALID",
      `${key} is required by an enabled AI provider.`,
    );
  }
  return value;
}

function nonNegativeNumber(value: string | undefined, key: string): number {
  const parsed = Number(value);
  if (!value?.trim() || !Number.isFinite(parsed) || parsed < 0) {
    throw new AiRuntimeError(
      "AI_CONFIGURATION_INVALID",
      `${key} must be a non-negative number for budget enforcement.`,
    );
  }
  return parsed;
}

function providerTier(value: string | undefined): AiProviderTier {
  const normalized = value?.trim().toLowerCase();
  return normalized === "paid" || normalized === "free"
    ? normalized
    : "unknown";
}

function safeLocalEndpoint(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AiRuntimeError(
      "AI_CONFIGURATION_INVALID",
      "AI_LOCAL_ENDPOINT must be an absolute URL.",
    );
  }
  const loopback =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new AiRuntimeError(
      "AI_CONFIGURATION_INVALID",
      "AI_LOCAL_ENDPOINT must use HTTPS or an HTTP loopback address.",
    );
  }
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/u, "");
}

function domainList(value: string | undefined): readonly string[] {
  if (!value?.trim()) return [];
  const domains = value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) =>
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u.test(
        entry,
      ),
    );
  return Array.from(new Set(domains)).slice(0, 100);
}

/**
 * Google reasoning controls are opt-in. Gemini 3 accepts `thinkingLevel` while
 * Gemini 2.5 accepts `thinkingConfig.thinkingBudget`, and sending the wrong
 * field is a hard request error, so nothing is sent unless an operator sets the
 * variable for the model they validated.
 */
function googleThinkingControls(
  environment: AiEnvironment,
): { level?: string; budget?: number } | undefined {
  const level = environment.AI_GOOGLE_THINKING_LEVEL?.trim().toLowerCase();
  const rawBudget = environment.AI_GOOGLE_THINKING_BUDGET?.trim();
  const controls: { level?: string; budget?: number } = {};

  if (level && ["minimal", "low", "medium", "high"].includes(level)) {
    controls.level = level;
  }

  if (rawBudget && /^-?\d+$/u.test(rawBudget)) {
    const budget = Number.parseInt(rawBudget, 10);
    if (budget >= -1 && budget <= 32_768) {
      controls.budget = budget;
    }
  }

  return controls.level === undefined && controls.budget === undefined
    ? undefined
    : controls;
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  key: string,
): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new AiRuntimeError(
      "AI_CONFIGURATION_INVALID",
      `${key} must be an integer from ${minimum} through ${maximum}.`,
    );
  }
  return parsed;
}
