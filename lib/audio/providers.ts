import { ArticleAudioError } from "./errors";
import type {
  ArticleAudioAdapter,
  ArticleAudioRuntimeConfig,
  AudioProvider,
  ProviderConfiguration,
  ProviderSynthesisRequest,
  ProviderSynthesisResult,
  ServerAudioProvider,
} from "./types";

export type ProviderExecutor = (
  request: ProviderSynthesisRequest,
  configuration: Readonly<ProviderConfiguration>,
) => Promise<ProviderSynthesisResult>;

abstract class DelegatingServerAdapter implements ArticleAudioAdapter {
  readonly execution = "SERVER" as const;
  abstract readonly provider: ServerAudioProvider;
  abstract readonly supportsTimingMetadata: boolean;

  constructor(
    protected readonly configuration: ProviderConfiguration,
    private readonly executor: ProviderExecutor | undefined,
  ) {}

  get maximumChunkCharacters(): number {
    return this.configuration.maximumChunkCharacters;
  }

  get modelId(): string {
    return this.configuration.modelId;
  }

  get voiceId(): string {
    return this.configuration.voiceId;
  }

  async synthesize(
    request: ProviderSynthesisRequest,
  ): Promise<ProviderSynthesisResult> {
    if (!this.executor) {
      throw new ArticleAudioError(
        "PROVIDER_UNAVAILABLE",
        `${this.provider} has no approved server transport.`,
        true,
      );
    }
    if (
      request.chunk.characterCount >
      this.configuration.maximumChunkCharacters
    ) {
      throw new ArticleAudioError(
        "PROVIDER_REJECTED",
        "The narration chunk exceeds the configured provider limit.",
      );
    }
    const result = await this.executor(request, this.configuration);
    validateProviderResult(result);
    return result;
  }
}

export class OpenAiTtsAdapter extends DelegatingServerAdapter {
  readonly provider = "OPENAI_TTS" as const;
  readonly supportsTimingMetadata = false;
}

export class GoogleCloudTtsAdapter extends DelegatingServerAdapter {
  readonly provider = "GOOGLE_CLOUD_TTS" as const;
  readonly supportsTimingMetadata = true;
}

export class ElevenLabsTtsAdapter extends DelegatingServerAdapter {
  readonly provider = "ELEVENLABS" as const;
  readonly supportsTimingMetadata = true;
}

export class BrowserSpeechFallbackAdapter implements ArticleAudioAdapter {
  readonly provider = "BROWSER_SPEECH_FALLBACK" as const;
  readonly execution = "CLIENT_ONLY" as const;
  readonly supportsTimingMetadata = false;
  readonly maximumChunkCharacters = 0;
  readonly modelId = null;
  readonly voiceId = null;

  async synthesize(): Promise<never> {
    throw new ArticleAudioError(
      "CLIENT_ONLY_FALLBACK",
      "Browser speech is a degraded client-only fallback and cannot create stored article audio.",
    );
  }
}

export class ArticleAudioAdapterRegistry {
  private readonly adapters = new Map<AudioProvider, ArticleAudioAdapter>();

  register(adapter: ArticleAudioAdapter): void {
    if (this.adapters.has(adapter.provider)) {
      throw new TypeError(`Duplicate article audio adapter: ${adapter.provider}`);
    }
    this.adapters.set(adapter.provider, adapter);
  }

  get(provider: AudioProvider): ArticleAudioAdapter | null {
    return this.adapters.get(provider) ?? null;
  }

  requireServer(provider: ServerAudioProvider): ArticleAudioAdapter {
    const adapter = this.get(provider);
    if (!adapter || adapter.execution !== "SERVER") {
      throw new ArticleAudioError(
        "PROVIDER_UNAVAILABLE",
        `${provider} is not available for server generation.`,
        true,
      );
    }
    return adapter;
  }

  publicFallback(): {
    provider: "BROWSER_SPEECH_FALLBACK";
    degraded: true;
  } | null {
    return this.adapters.has("BROWSER_SPEECH_FALLBACK")
      ? { provider: "BROWSER_SPEECH_FALLBACK", degraded: true }
      : null;
  }
}

export function createArticleAudioAdapterRegistry(
  config: ArticleAudioRuntimeConfig,
  executors: Partial<Record<ServerAudioProvider, ProviderExecutor>> = {},
): ArticleAudioAdapterRegistry {
  const registry = new ArticleAudioAdapterRegistry();
  for (const provider of config.providerOrder) {
    const providerConfiguration = config.providers.get(provider);
    if (!providerConfiguration) continue;
    if (provider === "OPENAI_TTS") {
      registry.register(
        new OpenAiTtsAdapter(
          providerConfiguration,
          executors.OPENAI_TTS,
        ),
      );
    } else if (provider === "GOOGLE_CLOUD_TTS") {
      registry.register(
        new GoogleCloudTtsAdapter(
          providerConfiguration,
          executors.GOOGLE_CLOUD_TTS,
        ),
      );
    } else {
      registry.register(
        new ElevenLabsTtsAdapter(
          providerConfiguration,
          executors.ELEVENLABS,
        ),
      );
    }
  }
  if (config.browserFallbackEnabled) {
    registry.register(new BrowserSpeechFallbackAdapter());
  }
  return registry;
}

function validateProviderResult(result: ProviderSynthesisResult): void {
  if (
    !(result.bytes instanceof Uint8Array) ||
    result.bytes.byteLength === 0 ||
    !result.contentType.startsWith("audio/") ||
    !Number.isInteger(result.durationMs) ||
    result.durationMs <= 0 ||
    !Number.isInteger(result.costMicros) ||
    result.costMicros < 0
  ) {
    throw new ArticleAudioError(
      "PROVIDER_REJECTED",
      "The provider returned invalid audio metadata.",
    );
  }
}
