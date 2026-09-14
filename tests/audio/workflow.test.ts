import { describe, expect, it } from "vitest";
import {
  createArticleAudioAdapterRegistry,
  executeArticleAudioGeneration,
  type ArticleAudioGenerationRepository,
  type ArticleAudioObjectStore,
  type ArticleAudioRecord,
  type ArticleAudioRuntimeConfig,
  type AudioChunkArtifact,
  type NarrationDocument,
  type StoredAudioObject,
} from "../../lib/audio";

describe("article audio generation workflow", () => {
  it("synthesizes once, stores immutable output, records timings, and invalidates cache", async () => {
    const memory = new Map<string, Uint8Array>();
    const transitions: string[] = [];
    const store = objectStore(memory);
    const repository = generationRepository(transitions);
    const config = runtimeConfig();
    let providerCalls = 0;
    const adapters = createArticleAudioAdapterRegistry(config, {
      OPENAI_TTS: async (request) => {
        providerCalls += 1;
        return {
          bytes: new Uint8Array([1, 2, 3]),
          contentType: "audio/mpeg",
          durationMs: 2_000,
          costMicros: 100,
          providerRequestId: "provider-request-secret",
          timings: [
            {
              text: request.chunk.text,
              startMs: 0,
              endMs: 2_000,
              chapterIndex: 0,
            },
          ],
        };
      },
    });
    let invalidated = false;

    const result = await executeArticleAudioGeneration({
      audio: audioRecord(),
      document: narrationDocument(),
      config,
      adapters,
      repository,
      objectStore: store,
      postProcessor: {
        async finalize({ chunks }) {
          return {
            bytes: chunks[0].bytes,
            contentType: "audio/mpeg",
            durationMs: chunks[0].durationMs,
          };
        },
      },
      cacheInvalidator: {
        async invalidateArticleAudio() {
          invalidated = true;
        },
      },
      now: new Date("2026-07-24T12:00:00.000Z"),
    });

    expect(result.replayed).toBe(false);
    expect(result.storageKey).toMatch(/article-audio\/v4\/.+\.mp3$/);
    expect(providerCalls).toBe(1);
    expect(transitions).toEqual(["CLAIMED", "CHUNK_READY", "PROCESSING", "READY"]);
    expect(invalidated).toBe(true);
  });

  it("does no provider or storage work when the ready generation replays", async () => {
    const config = runtimeConfig();
    let providerCalls = 0;
    const result = await executeArticleAudioGeneration({
      audio: {
        ...audioRecord(),
        state: "READY",
        storageKey: "article-audio/v4/existing.mp3",
      },
      document: narrationDocument(),
      config,
      adapters: createArticleAudioAdapterRegistry(config, {
        OPENAI_TTS: async () => {
          providerCalls += 1;
          throw new Error("should not run");
        },
      }),
      repository: {
        ...generationRepository([]),
        async claimGeneration() {
          return "REPLAY_READY";
        },
      },
      objectStore: objectStore(new Map()),
      postProcessor: {
        async finalize() {
          throw new Error("should not run");
        },
      },
      cacheInvalidator: {
        async invalidateArticleAudio() {
          throw new Error("should not run");
        },
      },
    });

    expect(result).toEqual({
      replayed: true,
      storageKey: "article-audio/v4/existing.mp3",
    });
    expect(providerCalls).toBe(0);
  });
});

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
          credential: "test-only-credential-that-is-long",
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

function audioRecord(): ArticleAudioRecord {
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
    characterCount: 18,
    chunkCount: 1,
    generationAttempt: 1,
    estimatedCostMicros: 270,
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

function narrationDocument(): NarrationDocument {
  return {
    articleId: "article_12345678",
    articleVersionId: "version_12345678",
    variant: "FULL_ARTICLE",
    title: "Verified headline",
    text: "Verified narration.",
    characterCount: 18,
    inputHash: "input_hash_12345678",
    chapters: [
      {
        id: "chapter-1",
        title: "Introduction",
        text: "Verified narration.",
        characterStart: 0,
        characterEnd: 18,
      },
    ],
  };
}

function objectStore(
  memory: Map<string, Uint8Array>,
): ArticleAudioObjectStore {
  return {
    async put(input): Promise<StoredAudioObject> {
      memory.set(input.key, input.bytes);
      return {
        key: input.key,
        etag: "etag",
        byteLength: input.bytes.byteLength,
        checksum: "checksum_12345678",
      };
    },
    async get(key) {
      return memory.get(key) ?? null;
    },
    async delete(key) {
      memory.delete(key);
    },
  };
}

function generationRepository(
  transitions: string[],
): ArticleAudioGenerationRepository {
  const completed = new Map<number, AudioChunkArtifact>();
  return {
    async claimGeneration() {
      transitions.push("CLAIMED");
      return "CLAIMED";
    },
    async findCompletedChunk(input) {
      return completed.get(input.ordinal) ?? null;
    },
    async saveCompletedChunk(input) {
      completed.set(input.chunk.ordinal, input.artifact);
      transitions.push("CHUNK_READY");
    },
    async markProcessing() {
      transitions.push("PROCESSING");
    },
    async markReady() {
      transitions.push("READY");
    },
    async markFailed() {
      transitions.push("FAILED");
    },
  };
}
