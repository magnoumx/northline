import type { DurableJobState } from "../jobs/state-machine";
import { ArticleAudioError } from "./errors";
import { buildNarrationDocument } from "./narration";
import { planArticleAudioGeneration } from "./state-machine";
import type {
  ArticleAudioRecord,
  ArticleAudioRuntimeConfig,
  ArticleAudioVariant,
  AudioGenerationPlan,
  ImmutablePublishedArticleVersion,
} from "./types";

export interface ArticleAudioRequestRepository {
  loadCurrentPublishedVersion(
    articleId: string,
    expectedArticleVersionId: string,
  ): Promise<ImmutablePublishedArticleVersion | null>;
  findByVersion(
    articleVersionId: string,
    variant: ArticleAudioVariant,
  ): Promise<ArticleAudioRecord | null>;
  dailyCommittedCostMicros(budgetDate: string): Promise<number>;
  queueGeneration(input: {
    article: ImmutablePublishedArticleVersion;
    documentInputHash: string;
    variant: ArticleAudioVariant;
    narrationPolicyVersion: string;
    provider: string;
    modelId: string;
    voiceId: string;
    outputFormat: string;
    characterCount: number;
    chunkCount: number;
    estimatedCostMicros: number;
    dailyBudgetMicros: number;
    storageBucket: string;
    downloadAllowed: boolean;
    requestedById: string;
    requestIdempotencyKey: string;
    cooldownUntil: Date;
    now: Date;
  }): Promise<{ audio: ArticleAudioRecord; replayed: boolean }>;
  rejectGeneration(input: {
    article: ImmutablePublishedArticleVersion;
    documentInputHash: string;
    variant: ArticleAudioVariant;
    narrationPolicyVersion: string;
    characterCount: number;
    reason: string;
    requestedById: string;
    now: Date;
  }): Promise<ArticleAudioRecord>;
  attachQueueJob(
    audioVersionId: string,
    queueJobId: string,
    now: Date,
  ): Promise<void>;
}

export interface ArticleAudioJobQueue {
  enqueue(input: {
    queue: string;
    kind: "article_audio.generate";
    idempotencyKey: string;
    payload: {
      articleId: string;
      articleVersionId: string;
      articleAudioVersionId: string;
      inputHash: string;
    };
    maximumAttempts: number;
  }): Promise<{
    job: { id: string; state: DurableJobState | string };
    replayed: boolean;
  }>;
}

export type ArticleAudioRequestResult = {
  plan: AudioGenerationPlan;
  audio: ArticleAudioRecord | null;
  queueReplayed: boolean;
};

export function createArticleAudioService(dependencies: {
  config: ArticleAudioRuntimeConfig;
  repository: ArticleAudioRequestRepository;
  queue: ArticleAudioJobQueue;
  queueName?: string;
}) {
  return {
    async requestGeneration(input: {
      articleId: string;
      expectedArticleVersionId: string;
      variant: ArticleAudioVariant;
      requestedById: string;
      idempotencyKey: string;
      forceRegeneration?: boolean;
      now?: Date;
    }): Promise<ArticleAudioRequestResult> {
      const now = input.now ?? new Date();
      const config = dependencies.config;
      if (!config.generationEnabled) {
        return {
          plan: {
            outcome: "DISABLED",
            reason: config.disabledReason ?? "FEATURE_DISABLED",
          },
          audio: null,
          queueReplayed: false,
        };
      }
      const article =
        await dependencies.repository.loadCurrentPublishedVersion(
          input.articleId,
          input.expectedArticleVersionId,
        );
      if (!article) {
        throw new ArticleAudioError(
          "ARTICLE_NOT_PUBLISHED",
          "Only the current immutable published article version can be narrated.",
        );
      }
      const document = await buildNarrationDocument(
        article,
        input.variant,
        config.narrationPolicyVersion,
      );
      const [existing, dailyCommittedCostMicros] = await Promise.all([
        dependencies.repository.findByVersion(
          article.articleVersionId,
          input.variant,
        ),
        dependencies.repository.dailyCommittedCostMicros(
          utcBudgetDate(now),
        ),
      ]);
      const plan = planArticleAudioGeneration({
        document,
        config,
        existing,
        dailyCommittedCostMicros,
        now,
        forceRegeneration: input.forceRegeneration,
      });
      if (plan.outcome === "REPLAY" || plan.outcome === "COOLDOWN") {
        return { plan, audio: plan.audio, queueReplayed: true };
      }
      if (plan.outcome === "DISABLED") {
        return { plan, audio: null, queueReplayed: false };
      }
      if (plan.outcome === "REJECT") {
        const audio = await dependencies.repository.rejectGeneration({
          article,
          documentInputHash: document.inputHash,
          variant: input.variant,
          narrationPolicyVersion: config.narrationPolicyVersion,
          characterCount: document.characterCount,
          reason: plan.reason,
          requestedById: input.requestedById,
          now,
        });
        return { plan, audio, queueReplayed: false };
      }
      if (!config.storageBucket) {
        throw new ArticleAudioError(
          "CONFIGURATION_INVALID",
          "Article audio storage is not configured.",
        );
      }
      const maximumCharacters = Math.min(
        plan.provider.maximumChunkCharacters,
        document.characterCount || 1,
      );
      const chunkCount = Math.max(
        1,
        Math.ceil(document.characterCount / maximumCharacters),
      );
      const queued = await dependencies.repository.queueGeneration({
        article,
        documentInputHash: document.inputHash,
        variant: input.variant,
        narrationPolicyVersion: config.narrationPolicyVersion,
        provider: plan.provider.provider,
        modelId: plan.provider.modelId,
        voiceId: plan.provider.voiceId,
        outputFormat: plan.provider.outputFormat,
        characterCount: document.characterCount,
        chunkCount,
        estimatedCostMicros: plan.estimatedCostMicros,
        dailyBudgetMicros: config.dailyBudgetMicros,
        storageBucket: config.storageBucket,
        downloadAllowed: config.downloadAllowed,
        requestedById: input.requestedById,
        requestIdempotencyKey: input.idempotencyKey,
        cooldownUntil: new Date(
          now.getTime() + config.regenerationCooldownSeconds * 1_000,
        ),
        now,
      });
      const job = await dependencies.queue.enqueue({
        queue:
          dependencies.queueName?.trim() ||
          "northline-article-audio",
        kind: "article_audio.generate",
        idempotencyKey: `audio.${queued.audio.id}.${document.inputHash}`,
        payload: {
          articleId: article.articleId,
          articleVersionId: article.articleVersionId,
          articleAudioVersionId: queued.audio.id,
          inputHash: document.inputHash,
        },
        maximumAttempts: 3,
      });
      await dependencies.repository.attachQueueJob(
        queued.audio.id,
        job.job.id,
        now,
      );
      return {
        plan,
        audio: queued.audio,
        queueReplayed: queued.replayed || job.replayed,
      };
    },
  };
}

export function utcBudgetDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
