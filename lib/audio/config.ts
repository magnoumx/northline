import { ArticleAudioError } from "./errors";
import type {
  ArticleAudioRuntimeConfig,
  AudioFormat,
  ProviderConfiguration,
  ServerAudioProvider,
} from "./types";

export type ArticleAudioEnvironment = Record<string, string | undefined>;

const SERVER_PROVIDERS: readonly ServerAudioProvider[] = [
  "OPENAI_TTS",
  "GOOGLE_CLOUD_TTS",
  "ELEVENLABS",
];

const PROVIDER_ENVIRONMENT = {
  OPENAI_TTS: {
    enabled: "TTS_OPENAI_ENABLED",
    model: "TTS_OPENAI_MODEL",
    voice: "TTS_OPENAI_VOICE",
    credential: "OPENAI_API_KEY",
    price: "TTS_OPENAI_USD_PER_MILLION_CHARACTERS",
    endpoint: "TTS_OPENAI_ENDPOINT",
  },
  GOOGLE_CLOUD_TTS: {
    enabled: "TTS_GOOGLE_ENABLED",
    model: "TTS_GOOGLE_MODEL",
    voice: "TTS_GOOGLE_VOICE",
    credential: "GOOGLE_CLOUD_TTS_API_KEY",
    price: "TTS_GOOGLE_USD_PER_MILLION_CHARACTERS",
    endpoint: "TTS_GOOGLE_ENDPOINT",
  },
  ELEVENLABS: {
    enabled: "TTS_ELEVENLABS_ENABLED",
    model: "TTS_ELEVENLABS_MODEL",
    voice: "TTS_ELEVENLABS_VOICE_ID",
    credential: "ELEVENLABS_API_KEY",
    price: "TTS_ELEVENLABS_USD_PER_MILLION_CHARACTERS",
    endpoint: "TTS_ELEVENLABS_ENDPOINT",
  },
} as const;

export function readArticleAudioConfig(
  environment: ArticleAudioEnvironment = process.env,
): ArticleAudioRuntimeConfig {
  const base = {
    browserFallbackEnabled:
      environment.BROWSER_SPEECH_FALLBACK_ENABLED === "true",
    providerOrder: [] as readonly ServerAudioProvider[],
    providers: new Map<ServerAudioProvider, ProviderConfiguration>(),
    dailyBudgetMicros: 0,
    perArticleBudgetMicros: 0,
    maximumArticleCharacters: 0,
    regenerationCooldownSeconds: 0,
    narrationPolicyVersion:
      environment.TTS_NARRATION_POLICY_VERSION?.trim() || "v4-initial",
    storageBucket: environment.ARTICLE_AUDIO_BUCKET?.trim() || null,
    storagePrefix: safeStoragePrefix(environment.ARTICLE_AUDIO_STORAGE_PREFIX),
    downloadAllowed: environment.ARTICLE_AUDIO_DOWNLOAD_ALLOWED === "true",
  };

  if (environment.FEATURE_ARTICLE_AUDIO !== "true") {
    return {
      ...base,
      generationEnabled: false,
      disabledReason: "FEATURE_DISABLED",
    };
  }
  if (environment.ARTICLE_AUDIO_GLOBAL_KILL !== "false") {
    return {
      ...base,
      generationEnabled: false,
      disabledReason: "GLOBAL_KILL",
    };
  }
  if (environment.DEMO_CONTENT_MODE === "true") {
    return {
      ...base,
      generationEnabled: false,
      disabledReason: "DEMO_MODE",
    };
  }
  if (
    environment.FEATURE_DURABLE_JOBS !== "true" ||
    environment.FEATURE_OBJECT_STORAGE !== "true"
  ) {
    return {
      ...base,
      generationEnabled: false,
      disabledReason: "DEPENDENCY_DISABLED",
    };
  }

  const outputFormat = parseOutputFormat(environment.TTS_OUTPUT_FORMAT);
  const maximumChunkCharacters = boundedInteger(
    environment.TTS_CHUNK_MAX_CHARACTERS,
    "TTS_CHUNK_MAX_CHARACTERS",
    250,
    4_000,
  );
  const providers = new Map<
    ServerAudioProvider,
    ProviderConfiguration
  >();
  for (const provider of SERVER_PROVIDERS) {
    const keys = PROVIDER_ENVIRONMENT[provider];
    if (environment[keys.enabled] !== "true") continue;
    providers.set(provider, {
      provider,
      modelId: required(environment, keys.model),
      voiceId: required(environment, keys.voice),
      credential: requiredSecret(environment, keys.credential),
      endpoint: optionalHttpsUrl(environment[keys.endpoint], keys.endpoint),
      outputFormat,
      maximumChunkCharacters,
      usdPerMillionCharacters: positiveNumber(environment, keys.price),
    });
  }
  const providerOrder = parseProviderOrder(
    required(environment, "TTS_PROVIDER_ORDER"),
  ).filter((provider) => providers.has(provider));
  if (providers.size === 0 || providerOrder.length === 0) {
    throw configurationError(
      "At least one explicitly enabled TTS provider must appear in TTS_PROVIDER_ORDER.",
    );
  }
  const storageBucket = required(environment, "ARTICLE_AUDIO_BUCKET");
  const dailyBudgetMicros = usdToMicros(
    positiveNumber(environment, "TTS_DAILY_BUDGET_USD"),
  );
  const perArticleBudgetMicros = usdToMicros(
    positiveNumber(environment, "TTS_PER_ARTICLE_BUDGET_USD"),
  );
  if (perArticleBudgetMicros > dailyBudgetMicros) {
    throw configurationError(
      "TTS_PER_ARTICLE_BUDGET_USD cannot exceed TTS_DAILY_BUDGET_USD.",
    );
  }

  return {
    ...base,
    generationEnabled: true,
    disabledReason: null,
    providerOrder,
    providers,
    dailyBudgetMicros,
    perArticleBudgetMicros,
    maximumArticleCharacters: boundedInteger(
      environment.TTS_MAX_ARTICLE_CHARACTERS,
      "TTS_MAX_ARTICLE_CHARACTERS",
      500,
      200_000,
    ),
    regenerationCooldownSeconds: boundedInteger(
      environment.TTS_REGENERATION_COOLDOWN,
      "TTS_REGENERATION_COOLDOWN",
      60,
      2_592_000,
    ),
    storageBucket,
  };
}

export function publicAudioAvailability(
  config: ArticleAudioRuntimeConfig,
): {
  generatedAudioEnabled: boolean;
  degradedBrowserFallbackEnabled: boolean;
  disclosure: "AI-generated narration";
} {
  return {
    generatedAudioEnabled: config.generationEnabled,
    degradedBrowserFallbackEnabled: config.browserFallbackEnabled,
    disclosure: "AI-generated narration",
  };
}

function parseProviderOrder(value: string): ServerAudioProvider[] {
  const aliases: Record<string, ServerAudioProvider> = {
    OPENAI: "OPENAI_TTS",
    OPENAI_TTS: "OPENAI_TTS",
    GOOGLE: "GOOGLE_CLOUD_TTS",
    GOOGLE_CLOUD_TTS: "GOOGLE_CLOUD_TTS",
    ELEVENLABS: "ELEVENLABS",
  };
  const parsed: ServerAudioProvider[] = [];
  for (const item of value.split(",")) {
    const provider = aliases[item.trim().toUpperCase()];
    if (!provider) {
      throw configurationError(
        `TTS_PROVIDER_ORDER contains unsupported provider '${item.trim()}'.`,
      );
    }
    if (!parsed.includes(provider)) parsed.push(provider);
  }
  return parsed;
}

function parseOutputFormat(value: string | undefined): AudioFormat {
  const format = (value?.trim().toUpperCase() || "MP3") as AudioFormat;
  if (!["MP3", "OPUS", "AAC", "FLAC", "WAV", "PCM"].includes(format)) {
    throw configurationError("TTS_OUTPUT_FORMAT is not supported.");
  }
  return format;
}

function safeStoragePrefix(value: string | undefined): string {
  const prefix = value?.trim() || "article-audio/v1";
  if (!/^[a-z0-9][a-z0-9/_-]{0,79}$/u.test(prefix) || prefix.includes("..")) {
    throw configurationError("ARTICLE_AUDIO_STORAGE_PREFIX is invalid.");
  }
  return prefix.replace(/\/+$/u, "");
}

function required(
  environment: ArticleAudioEnvironment,
  key: string,
): string {
  const value = environment[key]?.trim();
  if (!value) throw configurationError(`${key} is required.`);
  return value;
}

function requiredSecret(
  environment: ArticleAudioEnvironment,
  key: string,
): string {
  const value = required(environment, key);
  if (value.length < 20) {
    throw configurationError(`${key} is not a valid server credential.`);
  }
  return value;
}

function optionalHttpsUrl(
  value: string | undefined,
  key: string,
): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new Error("unsafe");
    }
    return url.toString();
  } catch {
    throw configurationError(`${key} must be an absolute HTTPS URL.`);
  }
}

function boundedInteger(
  value: string | undefined,
  key: string,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  if (
    !Number.isInteger(parsed) ||
    parsed < minimum ||
    parsed > maximum
  ) {
    throw configurationError(
      `${key} must be an integer between ${minimum} and ${maximum}.`,
    );
  }
  return parsed;
}

function positiveNumber(
  environment: ArticleAudioEnvironment,
  key: string,
): number {
  const parsed = Number(environment[key]);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1_000_000) {
    throw configurationError(`${key} must be a bounded positive number.`);
  }
  return parsed;
}

function usdToMicros(value: number): number {
  return Math.round(value * 1_000_000);
}

function configurationError(message: string): ArticleAudioError {
  return new ArticleAudioError("CONFIGURATION_INVALID", message);
}
