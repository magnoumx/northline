import { describe, expect, it, vi } from "vitest";
import {
  ArticleAudioError,
  createArticleAudioService,
  type ArticleAudioRecord,
  type ArticleAudioRuntimeConfig,
  type ImmutablePublishedArticleVersion,
} from "../../lib/audio";

describe("article audio request service", () => {
  it("does not touch storage or queues when generation is disabled", async () => {
    const repository = repositoryFixture();
    const queue = { enqueue: vi.fn() };
    const service = createArticleAudioService({
      config: {
        ...runtimeConfig(),
        generationEnabled: false,
        disabledReason: "GLOBAL_KILL",
      },
      repository,
      queue,
    });

    const result = await service.requestGeneration(request());

    expect(result.plan).toEqual({
      outcome: "DISABLED",
      reason: "GLOBAL_KILL",
    });
    expect(repository.loadCurrentPublishedVersion).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("refuses drafts and stale expected versions", async () => {
    const repository = repositoryFixture();
    repository.loadCurrentPublishedVersion.mockResolvedValue(null);
    const service = createArticleAudioService({
      config: runtimeConfig(),
      repository,
      queue: { enqueue: vi.fn() },
    });

    await expect(service.requestGeneration(request())).rejects.toMatchObject({
      code: "ARTICLE_NOT_PUBLISHED",
    } satisfies Partial<ArticleAudioError>);
  });

  it("queues only immutable identifiers and hashes, never article text or credentials", async () => {
    const repository = repositoryFixture();
    let queuedRequest: Record<string, unknown> | null = null;
    const queue = {
      enqueue: vi.fn(
        async (input: Record<string, unknown>) => {
          queuedRequest = input;
          return {
            job: { id: "job_audio_12345678", state: "QUEUED" },
            replayed: false,
          };
        },
      ),
    };
    const service = createArticleAudioService({
      config: runtimeConfig(),
      repository,
      queue,
    });

    const result = await service.requestGeneration(request());

    expect(result.audio?.state).toBe("QUEUED");
    expect(queue.enqueue).toHaveBeenCalledOnce();
    const queued = queuedRequest as unknown as {
      payload: Record<string, unknown>;
    };
    expect(queued.payload).toEqual({
      articleId: "article_12345678",
      articleVersionId: "version_12345678",
      articleAudioVersionId: "audio_12345678",
      inputHash: expect.any(String),
    });
    expect(JSON.stringify(queued)).not.toContain("Body text");
    expect(JSON.stringify(queued)).not.toContain("test-only-credential");
    expect(repository.attachQueueJob).toHaveBeenCalledWith(
      "audio_12345678",
      "job_audio_12345678",
      expect.any(Date),
    );
  });
});

function request() {
  return {
    articleId: "article_12345678",
    expectedArticleVersionId: "version_12345678",
    variant: "FULL_ARTICLE" as const,
    requestedById: "user_12345678",
    idempotencyKey: "audio-request-12345678",
    now: new Date("2026-07-24T12:00:00.000Z"),
  };
}

function runtimeConfig(): ArticleAudioRuntimeConfig {
  return {
    generationEnabled: true,
    disabledReason: null,
    browserFallbackEnabled: true,
    providerOrder: ["OPENAI_TTS"],
    providers: new Map([
      [
        "OPENAI_TTS",
        {
          provider: "OPENAI_TTS",
          modelId: "configured-model",
          voiceId: "configured-voice",
          credential: "test-only-credential-that-never-enters-jobs",
          outputFormat: "MP3",
          maximumChunkCharacters: 3_500,
          usdPerMillionCharacters: 15,
        },
      ],
    ]),
    dailyBudgetMicros: 5_000_000,
    perArticleBudgetMicros: 1_000_000,
    maximumArticleCharacters: 25_000,
    regenerationCooldownSeconds: 3_600,
    narrationPolicyVersion: "policy-1",
    storageBucket: "audio",
    storagePrefix: "article-audio/v4",
    downloadAllowed: false,
  };
}

function publishedArticle(): ImmutablePublishedArticleVersion {
  return {
    articleId: "article_12345678",
    articleVersionId: "version_12345678",
    versionNumber: 1,
    publishedAt: new Date("2026-07-24T11:00:00.000Z"),
    headline: "Verified headline",
    subheadline: "Verified summary",
    bodyJson: JSON.stringify([
      { heading: "Details", paragraphs: ["Body text."] },
    ]),
    keyTakeawaysJson: "[]",
    category: "Policy",
    sensitive: false,
  };
}

function queuedAudio(): ArticleAudioRecord {
  return {
    id: "audio_12345678",
    articleId: "article_12345678",
    articleVersionId: "version_12345678",
    variant: "FULL_ARTICLE",
    state: "QUEUED",
    inputHash: "input_hash_12345678",
    provider: "OPENAI_TTS",
    modelId: "configured-model",
    voiceId: "configured-voice",
    characterCount: 50,
    chunkCount: 1,
    generationAttempt: 1,
    estimatedCostMicros: 750,
    actualCostMicros: null,
    storageKey: null,
    contentType: null,
    durationMs: null,
    cooldownUntil: null,
    queueJobId: null,
    requestedAt: new Date("2026-07-24T12:00:00.000Z"),
    updatedAt: new Date("2026-07-24T12:00:00.000Z"),
  };
}

function repositoryFixture() {
  return {
    loadCurrentPublishedVersion: vi.fn(
      async (): Promise<ImmutablePublishedArticleVersion | null> =>
        publishedArticle(),
    ),
    findByVersion: vi.fn(
      async (): Promise<ArticleAudioRecord | null> => null,
    ),
    dailyCommittedCostMicros: vi.fn(async (): Promise<number> => 0),
    queueGeneration: vi.fn(
      async (): Promise<{
        audio: ArticleAudioRecord;
        replayed: boolean;
      }> => ({
        audio: queuedAudio(),
        replayed: false,
      }),
    ),
    rejectGeneration: vi.fn(
      async (): Promise<ArticleAudioRecord> => queuedAudio(),
    ),
    attachQueueJob: vi.fn(async (): Promise<void> => undefined),
  };
}
