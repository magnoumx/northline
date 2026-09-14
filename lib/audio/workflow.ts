import { sha256Base64Url } from "../security/crypto";
import { ArticleAudioError } from "./errors";
import {
  DEFAULT_NARRATION_INSTRUCTION,
  chunkNarrationDocument,
} from "./narration";
import type { ArticleAudioAdapterRegistry } from "./providers";
import {
  buildChunkAudioObjectKey,
  buildFinalAudioObjectKey,
  type ArticleAudioObjectStore,
  type StoredAudioObject,
} from "./storage";
import type {
  ArticleAudioRecord,
  ArticleAudioRuntimeConfig,
  AudioChapterTiming,
  AudioTiming,
  NarrationChunk,
  NarrationDocument,
  ProviderSynthesisResult,
} from "./types";

export type AudioChunkArtifact = {
  ordinal: number;
  textHash: string;
  storageKey: string;
  contentType: string;
  durationMs: number;
  costMicros: number;
  timings: readonly AudioTiming[];
};

export interface ArticleAudioGenerationRepository {
  claimGeneration(input: {
    audioVersionId: string;
    inputHash: string;
    provider: string;
    modelId: string;
    voiceId: string;
    now: Date;
  }): Promise<"CLAIMED" | "REPLAY_READY">;
  findCompletedChunk(input: {
    audioVersionId: string;
    ordinal: number;
    textHash: string;
  }): Promise<AudioChunkArtifact | null>;
  saveCompletedChunk(input: {
    audioVersionId: string;
    chunk: NarrationChunk;
    artifact: AudioChunkArtifact;
    providerRequestIdHash: string | null;
    now: Date;
  }): Promise<void>;
  markProcessing(audioVersionId: string, now: Date): Promise<void>;
  markReady(input: {
    audioVersionId: string;
    object: StoredAudioObject;
    contentType: string;
    durationMs: number;
    actualCostMicros: number;
    incrementalCostMicros: number;
    chapterTimings: readonly AudioChapterTiming[];
    timings: readonly AudioTiming[];
    now: Date;
  }): Promise<void>;
  markFailed(input: {
    audioVersionId: string;
    code: string;
    errorDigest: string;
    cooldownUntil: Date;
    now: Date;
  }): Promise<void>;
}

export interface AudioPostProcessor {
  finalize(input: {
    chunks: readonly {
      bytes: Uint8Array;
      contentType: string;
      durationMs: number;
    }[];
    outputFormat: string;
    targetLoudnessLufs: number;
    maximumGapMs: number;
  }): Promise<{
    bytes: Uint8Array;
    contentType: string;
    durationMs: number;
  }>;
}

export interface ArticleAudioCacheInvalidator {
  invalidateArticleAudio(input: {
    articleId: string;
    articleVersionId: string;
  }): Promise<void>;
}

export async function executeArticleAudioGeneration(input: {
  audio: ArticleAudioRecord;
  document: NarrationDocument;
  config: ArticleAudioRuntimeConfig;
  adapters: ArticleAudioAdapterRegistry;
  repository: ArticleAudioGenerationRepository;
  objectStore: ArticleAudioObjectStore;
  postProcessor: AudioPostProcessor;
  cacheInvalidator: ArticleAudioCacheInvalidator;
  now?: Date;
}): Promise<{ replayed: boolean; storageKey: string | null }> {
  const now = input.now ?? new Date();
  const providerId = input.audio.provider;
  if (!input.config.generationEnabled || !providerId) {
    throw new ArticleAudioError(
      "FEATURE_DISABLED",
      "Article audio generation is disabled.",
    );
  }
  if (
    input.audio.inputHash !== input.document.inputHash ||
    input.audio.articleVersionId !== input.document.articleVersionId
  ) {
    throw new ArticleAudioError(
      "ARTICLE_VERSION_CONFLICT",
      "The queued audio input no longer matches the immutable article version.",
    );
  }
  const provider = input.config.providers.get(providerId);
  if (!provider) {
    throw new ArticleAudioError(
      "PROVIDER_UNAVAILABLE",
      "The queued TTS provider is no longer approved.",
      true,
    );
  }
  const adapter = input.adapters.requireServer(providerId);
  const claim = await input.repository.claimGeneration({
    audioVersionId: input.audio.id,
    inputHash: input.document.inputHash,
    provider: providerId,
    modelId: provider.modelId,
    voiceId: provider.voiceId,
    now,
  });
  if (claim === "REPLAY_READY") {
    return { replayed: true, storageKey: input.audio.storageKey };
  }

  const createdChunkKeys: string[] = [];
  try {
    const chunks = await chunkNarrationDocument(
      input.document,
      Math.min(
        provider.maximumChunkCharacters,
        adapter.maximumChunkCharacters,
      ),
    );
    const generated: Array<{
      chunk: NarrationChunk;
      result: ProviderSynthesisResult;
      storageKey: string;
      reused: boolean;
    }> = [];
    for (const [chunkIndex, chunk] of chunks.entries()) {
      const existing = await input.repository.findCompletedChunk({
        audioVersionId: input.audio.id,
        ordinal: chunk.ordinal,
        textHash: chunk.textHash,
      });
      if (existing) {
        const bytes = await input.objectStore.get(existing.storageKey);
        if (bytes) {
          generated.push({
            chunk,
            storageKey: existing.storageKey,
            result: {
              bytes,
              contentType: existing.contentType,
              durationMs: existing.durationMs,
              costMicros: existing.costMicros,
              timings: existing.timings,
            },
            reused: true,
          });
          continue;
        }
      }

      const result = await adapter.synthesize({
        articleAudioVersionId: input.audio.id,
        chunk,
        instruction: DEFAULT_NARRATION_INSTRUCTION,
        outputFormat: provider.outputFormat,
        idempotencyKey: `${input.audio.id}:${chunk.ordinal}:${chunk.textHash}`,
        previousText: chunks[chunkIndex - 1]?.text.slice(-1_500),
        nextText: chunks[chunkIndex + 1]?.text.slice(0, 1_500),
      });
      const chunkKey = buildChunkAudioObjectKey({
        prefix: input.config.storagePrefix,
        articleAudioVersionId: input.audio.id,
        ordinal: chunk.ordinal,
        textHash: chunk.textHash,
        outputFormat: provider.outputFormat,
      });
      await input.objectStore.put({
        key: chunkKey,
        bytes: result.bytes,
        contentType: result.contentType,
        cacheControl: "private, max-age=86400",
        metadata: {
          articleId: input.audio.articleId,
          articleVersionId: input.audio.articleVersionId,
          articleAudioVersionId: input.audio.id,
          variant: input.audio.variant,
          inputHash: input.audio.inputHash,
          provider: providerId,
          outputFormat: provider.outputFormat,
          immutable: "true",
        },
      });
      createdChunkKeys.push(chunkKey);
      const requestIdHash = result.providerRequestId
        ? await sha256Base64Url(result.providerRequestId)
        : null;
      const artifact: AudioChunkArtifact = {
        ordinal: chunk.ordinal,
        textHash: chunk.textHash,
        storageKey: chunkKey,
        contentType: result.contentType,
        durationMs: result.durationMs,
        costMicros: result.costMicros,
        timings: result.timings ?? [],
      };
      await input.repository.saveCompletedChunk({
        audioVersionId: input.audio.id,
        chunk,
        artifact,
        providerRequestIdHash: requestIdHash,
        now,
      });
      generated.push({ chunk, result, storageKey: chunkKey, reused: false });
    }

    await input.repository.markProcessing(input.audio.id, now);
    const finalized = await input.postProcessor.finalize({
      chunks: generated.map(({ result }) => ({
        bytes: result.bytes,
        contentType: result.contentType,
        durationMs: result.durationMs,
      })),
      outputFormat: provider.outputFormat,
      targetLoudnessLufs: -16,
      maximumGapMs: 80,
    });
    validateFinalizedAudio(finalized);
    if (finalized.durationMs <= 0) {
      throw new ArticleAudioError(
        "POST_PROCESSING_UNAVAILABLE",
        "Audio post-processing returned an invalid duration.",
      );
    }
    const actualCostMicros = generated.reduce(
      (sum, item) => sum + item.result.costMicros,
      0,
    );
    const incrementalCostMicros = generated.reduce(
      (sum, item) => sum + (item.reused ? 0 : item.result.costMicros),
      0,
    );
    if (actualCostMicros > input.config.perArticleBudgetMicros) {
      throw new ArticleAudioError(
        "BUDGET_EXCEEDED",
        "Final TTS cost exceeded the per-article budget.",
      );
    }
    const finalKey = buildFinalAudioObjectKey({
      prefix: input.config.storagePrefix,
      articleId: input.audio.articleId,
      articleVersionId: input.audio.articleVersionId,
      variant: input.audio.variant,
      inputHash: input.audio.inputHash,
      outputFormat: provider.outputFormat,
      generationAttempt: input.audio.generationAttempt,
    });
    const object = await input.objectStore.put({
      key: finalKey,
      bytes: finalized.bytes,
      contentType: finalized.contentType,
      cacheControl: "public, max-age=31536000, immutable",
      metadata: {
        articleId: input.audio.articleId,
        articleVersionId: input.audio.articleVersionId,
        articleAudioVersionId: input.audio.id,
        variant: input.audio.variant,
        inputHash: input.audio.inputHash,
        provider: providerId,
        outputFormat: provider.outputFormat,
        immutable: "true",
      },
    });
    const timingMetadata = buildTimingMetadata(input.document, generated);
    await input.repository.markReady({
      audioVersionId: input.audio.id,
      object,
      contentType: finalized.contentType,
      durationMs: finalized.durationMs,
      actualCostMicros,
      incrementalCostMicros,
      chapterTimings: timingMetadata.chapters,
      timings: timingMetadata.timings,
      now,
    });
    await input.cacheInvalidator.invalidateArticleAudio({
      articleId: input.audio.articleId,
      articleVersionId: input.audio.articleVersionId,
    });
    await Promise.allSettled(
      createdChunkKeys.map((key) => input.objectStore.delete(key)),
    );
    return { replayed: false, storageKey: finalKey };
  } catch (error) {
    const code =
      error instanceof ArticleAudioError ? error.code : "PROVIDER_UNAVAILABLE";
    const digest = await sha256Base64Url(
      error instanceof Error ? error.message : "Unknown article audio failure",
    );
    await input.repository.markFailed({
      audioVersionId: input.audio.id,
      code,
      errorDigest: digest,
      cooldownUntil: new Date(
        now.getTime() +
          input.config.regenerationCooldownSeconds * 1_000,
      ),
      now,
    });
    throw error;
  }
}

function buildTimingMetadata(
  document: NarrationDocument,
  generated: readonly {
    chunk: NarrationChunk;
    result: ProviderSynthesisResult;
  }[],
): {
  chapters: AudioChapterTiming[];
  timings: AudioTiming[];
} {
  const chapterBounds = document.chapters.map(() => ({
    startMs: Number.POSITIVE_INFINITY,
    endMs: 0,
  }));
  const timings: AudioTiming[] = [];
  let offset = 0;
  for (const item of generated) {
    const bounds = chapterBounds[item.chunk.chapterIndex];
    bounds.startMs = Math.min(bounds.startMs, offset);
    bounds.endMs = Math.max(bounds.endMs, offset + item.result.durationMs);
    for (const timing of item.result.timings ?? []) {
      timings.push({
        ...timing,
        chapterIndex: item.chunk.chapterIndex,
        startMs: offset + timing.startMs,
        endMs: offset + timing.endMs,
      });
    }
    offset += item.result.durationMs;
  }
  return {
    chapters: document.chapters.map((chapter, index) => ({
      id: chapter.id,
      title: chapter.title,
      startMs: Number.isFinite(chapterBounds[index].startMs)
        ? chapterBounds[index].startMs
        : 0,
      endMs: chapterBounds[index].endMs,
    })),
    timings,
  };
}

function validateFinalizedAudio(value: {
  bytes: Uint8Array;
  contentType: string;
  durationMs: number;
}): void {
  if (
    !(value.bytes instanceof Uint8Array) ||
    value.bytes.byteLength === 0 ||
    !value.contentType.startsWith("audio/") ||
    !Number.isInteger(value.durationMs) ||
    value.durationMs <= 0
  ) {
    throw new ArticleAudioError(
      "POST_PROCESSING_UNAVAILABLE",
      "The audio post-processor returned an invalid artifact.",
    );
  }
}
