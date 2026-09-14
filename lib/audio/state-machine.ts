import { ArticleAudioError } from "./errors";
import type {
  ArticleAudioRecord,
  ArticleAudioRuntimeConfig,
  ArticleAudioState,
  AudioGenerationPlan,
  NarrationDocument,
  ProviderConfiguration,
} from "./types";

const TRANSITIONS: Readonly<
  Record<ArticleAudioState, readonly ArticleAudioState[]>
> = {
  NOT_REQUESTED: ["QUEUED", "REJECTED"],
  QUEUED: ["GENERATING", "FAILED", "STALE", "REJECTED"],
  GENERATING: ["PROCESSING", "FAILED", "STALE"],
  PROCESSING: ["READY", "FAILED", "STALE"],
  READY: ["STALE"],
  FAILED: ["QUEUED", "STALE", "REJECTED"],
  STALE: ["QUEUED", "REJECTED"],
  REJECTED: ["QUEUED"],
};

export function canTransitionArticleAudio(
  from: ArticleAudioState,
  to: ArticleAudioState,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertArticleAudioTransition(
  from: ArticleAudioState,
  to: ArticleAudioState,
): void {
  if (!canTransitionArticleAudio(from, to)) {
    throw new ArticleAudioError(
      "STATE_CONFLICT",
      `Article audio cannot transition from ${from} to ${to}.`,
    );
  }
}

export function estimateProviderCostMicros(
  characterCount: number,
  provider: ProviderConfiguration,
): number {
  if (!Number.isInteger(characterCount) || characterCount < 0) {
    throw new RangeError("Character count must be a non-negative integer.");
  }
  return Math.ceil(
    characterCount * provider.usdPerMillionCharacters,
  );
}

export function planArticleAudioGeneration(input: {
  document: NarrationDocument;
  config: ArticleAudioRuntimeConfig;
  existing: ArticleAudioRecord | null;
  dailyCommittedCostMicros: number;
  now: Date;
  forceRegeneration?: boolean;
}): AudioGenerationPlan {
  const { config, document, existing, now } = input;
  if (!config.generationEnabled) {
    return {
      outcome: "DISABLED",
      reason: config.disabledReason ?? "FEATURE_DISABLED",
    };
  }
  if (
    existing &&
    existing.inputHash === document.inputHash &&
    ["QUEUED", "GENERATING", "PROCESSING"].includes(existing.state)
  ) {
    return { outcome: "REPLAY", audio: existing };
  }
  if (
    existing &&
    existing.inputHash === document.inputHash &&
    existing.state === "READY" &&
    !input.forceRegeneration
  ) {
    return { outcome: "REPLAY", audio: existing };
  }
  if (
    existing?.cooldownUntil &&
    existing.cooldownUntil.getTime() > now.getTime()
  ) {
    return {
      outcome: "COOLDOWN",
      audio: existing,
      retryAt: existing.cooldownUntil,
    };
  }
  if (document.characterCount > config.maximumArticleCharacters) {
    return {
      outcome: "REJECT",
      reason: "ARTICLE_TOO_LONG",
      characterCount: document.characterCount,
    };
  }
  let sawPerArticleBudgetFailure = false;
  let sawDailyBudgetFailure = false;
  for (const providerId of config.providerOrder) {
    const provider = config.providers.get(providerId);
    if (!provider) continue;
    const estimate = estimateProviderCostMicros(
      document.characterCount,
      provider,
    );
    if (estimate > config.perArticleBudgetMicros) {
      sawPerArticleBudgetFailure = true;
      continue;
    }
    if (
      input.dailyCommittedCostMicros + estimate >
      config.dailyBudgetMicros
    ) {
      sawDailyBudgetFailure = true;
      continue;
    }
    return {
      outcome: "QUEUE",
      document,
      provider,
      estimatedCostMicros: estimate,
      markExistingStale: Boolean(existing && existing.state === "READY"),
    };
  }
  if (config.providerOrder.length === 0) {
    return {
      outcome: "REJECT",
      reason: "NO_PROVIDER",
      characterCount: document.characterCount,
    };
  }
  return {
    outcome: "REJECT",
    reason: sawDailyBudgetFailure
      ? "DAILY_BUDGET"
      : sawPerArticleBudgetFailure
        ? "PER_ARTICLE_BUDGET"
        : "NO_PROVIDER",
    characterCount: document.characterCount,
  };
}
