import { describe, expect, it } from "vitest";
import {
  ArticleAudioError,
  BrowserSpeechFallbackAdapter,
  createArticleAudioAdapterRegistry,
  publicAudioAvailability,
  readArticleAudioConfig,
} from "../../lib/audio";

describe("article audio configuration", () => {
  it("fails closed without requiring provider secrets when disabled", () => {
    const config = readArticleAudioConfig({});

    expect(config.generationEnabled).toBe(false);
    expect(config.disabledReason).toBe("FEATURE_DISABLED");
    expect(config.providers.size).toBe(0);
  });

  it("keeps server generation disabled in demo mode", () => {
    const config = readArticleAudioConfig({
      FEATURE_ARTICLE_AUDIO: "true",
      ARTICLE_AUDIO_GLOBAL_KILL: "false",
      DEMO_CONTENT_MODE: "true",
      BROWSER_SPEECH_FALLBACK_ENABLED: "true",
    });

    expect(config.generationEnabled).toBe(false);
    expect(config.disabledReason).toBe("DEMO_MODE");
    expect(publicAudioAvailability(config)).toEqual({
      generatedAudioEnabled: false,
      degradedBrowserFallbackEnabled: true,
      disclosure: "AI-generated narration",
    });
  });

  it("requires explicit model and voice IDs for an enabled provider", () => {
    const environment = operationalEnvironment();
    delete environment.TTS_OPENAI_MODEL;

    expect(() => readArticleAudioConfig(environment)).toThrow(
      "TTS_OPENAI_MODEL is required",
    );
  });

  it("builds an ordered registry without a hardcoded model or voice", () => {
    const config = readArticleAudioConfig(operationalEnvironment());
    const registry = createArticleAudioAdapterRegistry(config, {
      OPENAI_TTS: async () => ({
        bytes: new Uint8Array([1]),
        contentType: "audio/mpeg",
        durationMs: 1_000,
        costMicros: 10,
      }),
    });

    expect(config.generationEnabled).toBe(true);
    expect(config.providerOrder).toEqual(["OPENAI_TTS"]);
    expect(registry.requireServer("OPENAI_TTS").modelId).toBe(
      "account-approved-model",
    );
    expect(registry.requireServer("OPENAI_TTS").voiceId).toBe(
      "account-approved-voice",
    );
    expect(registry.publicFallback()).toEqual({
      provider: "BROWSER_SPEECH_FALLBACK",
      degraded: true,
    });
  });
});

describe("browser speech fallback", () => {
  it("cannot synthesize or masquerade as stored premium audio", async () => {
    const adapter = new BrowserSpeechFallbackAdapter();

    await expect(adapter.synthesize()).rejects.toMatchObject({
      code: "CLIENT_ONLY_FALLBACK",
    } satisfies Partial<ArticleAudioError>);
    expect(adapter.execution).toBe("CLIENT_ONLY");
  });
});

function operationalEnvironment(): Record<string, string> {
  return {
    FEATURE_ARTICLE_AUDIO: "true",
    ARTICLE_AUDIO_GLOBAL_KILL: "false",
    DEMO_CONTENT_MODE: "false",
    FEATURE_DURABLE_JOBS: "true",
    FEATURE_OBJECT_STORAGE: "true",
    BROWSER_SPEECH_FALLBACK_ENABLED: "true",
    ARTICLE_AUDIO_BUCKET: "northline-audio",
    ARTICLE_AUDIO_STORAGE_PREFIX: "article-audio/v4",
    TTS_PROVIDER_ORDER: "openai",
    TTS_OPENAI_ENABLED: "true",
    TTS_OPENAI_MODEL: "account-approved-model",
    TTS_OPENAI_VOICE: "account-approved-voice",
    OPENAI_API_KEY: "test-only-key-that-is-long-enough",
    TTS_OPENAI_USD_PER_MILLION_CHARACTERS: "15",
    TTS_OUTPUT_FORMAT: "mp3",
    TTS_CHUNK_MAX_CHARACTERS: "3500",
    TTS_DAILY_BUDGET_USD: "10",
    TTS_PER_ARTICLE_BUDGET_USD: "1",
    TTS_MAX_ARTICLE_CHARACTERS: "25000",
    TTS_REGENERATION_COOLDOWN: "3600",
    TTS_NARRATION_POLICY_VERSION: "test-policy",
  };
}
