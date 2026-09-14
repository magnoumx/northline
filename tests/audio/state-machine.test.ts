import { describe, expect, it } from "vitest";
import {
  assertArticleAudioTransition,
  estimateProviderCostMicros,
  planArticleAudioGeneration,
  type ArticleAudioRecord,
  type ArticleAudioRuntimeConfig,
  type NarrationDocument,
  type ProviderConfiguration,
} from "../../lib/audio";

describe("article audio state and budget planning", () => {
  it("allows only explicit state transitions", () => {
    expect(() =>
      assertArticleAudioTransition("QUEUED", "GENERATING"),
    ).not.toThrow();
    expect(() =>
      assertArticleAudioTransition("READY", "GENERATING"),
    ).toThrow("cannot transition");
  });

  it("estimates microdollars without float conversion ambiguity", () => {
    expect(estimateProviderCostMicros(1_000, provider(15))).toBe(15_000);
  });

  it("replays in-flight work even when force was requested", () => {
    const existing = audio({ state: "GENERATING" });
    const plan = planArticleAudioGeneration({
      document: document(),
      config: config(),
      existing,
      dailyCommittedCostMicros: 0,
      now: new Date("2026-07-24T12:00:00.000Z"),
      forceRegeneration: true,
    });

    expect(plan.outcome).toBe("REPLAY");
  });

  it("rejects overlong narration before provider selection", () => {
    const plan = planArticleAudioGeneration({
      document: { ...document(), characterCount: 25_001 },
      config: config(),
      existing: null,
      dailyCommittedCostMicros: 0,
      now: new Date(),
    });

    expect(plan).toMatchObject({
      outcome: "REJECT",
      reason: "ARTICLE_TOO_LONG",
    });
  });

  it("uses an approved lower-cost fallback when the first route exceeds budget", () => {
    const expensive = provider(1_000, "OPENAI_TTS");
    const affordable = provider(5, "GOOGLE_CLOUD_TTS");
    const runtime = config();
    runtime.providerOrder = ["OPENAI_TTS", "GOOGLE_CLOUD_TTS"];
    runtime.providers = new Map([
      ["OPENAI_TTS", expensive],
      ["GOOGLE_CLOUD_TTS", affordable],
    ]);
    runtime.perArticleBudgetMicros = 100_000;
    const plan = planArticleAudioGeneration({
      document: document(),
      config: runtime,
      existing: null,
      dailyCommittedCostMicros: 0,
      now: new Date(),
    });

    expect(plan).toMatchObject({
      outcome: "QUEUE",
      provider: { provider: "GOOGLE_CLOUD_TTS" },
    });
  });

  it("rejects when committed cost would cross the daily cap", () => {
    const runtime = config();
    runtime.dailyBudgetMicros = 20_000;
    const plan = planArticleAudioGeneration({
      document: document(),
      config: runtime,
      existing: null,
      dailyCommittedCostMicros: 10_000,
      now: new Date(),
    });

    expect(plan).toMatchObject({
      outcome: "REJECT",
      reason: "DAILY_BUDGET",
    });
  });
});

function provider(
  price: number,
  id: ProviderConfiguration["provider"] = "OPENAI_TTS",
): ProviderConfiguration {
  return {
    provider: id,
    modelId: "configured-model",
    voiceId: "configured-voice",
    credential: "test-only-credential-that-is-long",
    outputFormat: "MP3",
    maximumChunkCharacters: 3_500,
    usdPerMillionCharacters: price,
  };
}

function config(): ArticleAudioRuntimeConfig {
  const configured = provider(15);
  return {
    generationEnabled: true,
    disabledReason: null,
    browserFallbackEnabled: true,
    providerOrder: ["OPENAI_TTS"],
    providers: new Map([["OPENAI_TTS", configured]]),
    dailyBudgetMicros: 1_000_000,
    perArticleBudgetMicros: 500_000,
    maximumArticleCharacters: 25_000,
    regenerationCooldownSeconds: 3_600,
    narrationPolicyVersion: "policy-1",
    storageBucket: "audio",
    storagePrefix: "article-audio/v4",
    downloadAllowed: false,
  };
}

function document(): NarrationDocument {
  return {
    articleId: "article_12345678",
    articleVersionId: "version_12345678",
    variant: "FULL_ARTICLE",
    title: "Headline",
    text: "Narration",
    characterCount: 1_000,
    inputHash: "input_hash_12345678",
    chapters: [
      {
        id: "chapter-1",
        title: "Introduction",
        text: "Narration",
        characterStart: 0,
        characterEnd: 9,
      },
    ],
  };
}

function audio(
  overrides: Partial<ArticleAudioRecord> = {},
): ArticleAudioRecord {
  return {
    id: "audio_12345678",
    articleId: "article_12345678",
    articleVersionId: "version_12345678",
    variant: "FULL_ARTICLE",
    state: "READY",
    inputHash: "input_hash_12345678",
    provider: "OPENAI_TTS",
    modelId: "configured-model",
    voiceId: "configured-voice",
    characterCount: 1_000,
    chunkCount: 1,
    generationAttempt: 1,
    estimatedCostMicros: 15_000,
    actualCostMicros: 15_000,
    storageKey: "article-audio/file.mp3",
    contentType: "audio/mpeg",
    durationMs: 10_000,
    cooldownUntil: null,
    queueJobId: null,
    requestedAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
