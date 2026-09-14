export const ARTICLE_AUDIO_STATES = [
  "NOT_REQUESTED",
  "QUEUED",
  "GENERATING",
  "PROCESSING",
  "READY",
  "FAILED",
  "STALE",
  "REJECTED",
] as const;

export type ArticleAudioState = (typeof ARTICLE_AUDIO_STATES)[number];

export const ARTICLE_AUDIO_VARIANTS = [
  "FULL_ARTICLE",
  "QUICK_BRIEF",
] as const;

export type ArticleAudioVariant = (typeof ARTICLE_AUDIO_VARIANTS)[number];

export const AUDIO_PROVIDERS = [
  "OPENAI_TTS",
  "GOOGLE_CLOUD_TTS",
  "ELEVENLABS",
  "BROWSER_SPEECH_FALLBACK",
] as const;

export type AudioProvider = (typeof AUDIO_PROVIDERS)[number];
export type ServerAudioProvider = Exclude<
  AudioProvider,
  "BROWSER_SPEECH_FALLBACK"
>;

export const AUDIO_FORMATS = [
  "MP3",
  "OPUS",
  "AAC",
  "FLAC",
  "WAV",
  "PCM",
] as const;

export type AudioFormat = (typeof AUDIO_FORMATS)[number];

export type ImmutablePublishedArticleVersion = {
  articleId: string;
  articleVersionId: string;
  versionNumber: number;
  publishedAt: Date;
  headline: string;
  subheadline: string | null;
  bodyJson: string;
  keyTakeawaysJson: string;
  category: string;
  sensitive: boolean;
};

export type NarrationChapter = {
  id: string;
  title: string;
  text: string;
  characterStart: number;
  characterEnd: number;
};

export type NarrationDocument = {
  articleId: string;
  articleVersionId: string;
  variant: ArticleAudioVariant;
  title: string;
  text: string;
  characterCount: number;
  inputHash: string;
  chapters: readonly NarrationChapter[];
};

export type NarrationChunk = {
  id: string;
  ordinal: number;
  chapterIndex: number;
  text: string;
  characterCount: number;
  textHash: string;
};

export type AudioTiming = {
  text: string;
  startMs: number;
  endMs: number;
  chapterIndex: number;
};

export type AudioChapterTiming = {
  id: string;
  title: string;
  startMs: number;
  endMs: number;
};

export type ProviderSynthesisRequest = {
  articleAudioVersionId: string;
  chunk: NarrationChunk;
  instruction: string;
  outputFormat: AudioFormat;
  idempotencyKey: string;
  previousText?: string;
  nextText?: string;
};

export type ProviderSynthesisResult = {
  bytes: Uint8Array;
  contentType: string;
  durationMs: number;
  costMicros: number;
  providerRequestId?: string;
  timings?: readonly AudioTiming[];
};

export type ProviderConfiguration = {
  provider: ServerAudioProvider;
  modelId: string;
  voiceId: string;
  credential: string;
  endpoint?: string;
  outputFormat: AudioFormat;
  maximumChunkCharacters: number;
  usdPerMillionCharacters: number;
};

export interface ArticleAudioAdapter {
  readonly provider: AudioProvider;
  readonly execution: "SERVER" | "CLIENT_ONLY";
  readonly supportsTimingMetadata: boolean;
  readonly maximumChunkCharacters: number;
  readonly modelId: string | null;
  readonly voiceId: string | null;
  synthesize(
    request: ProviderSynthesisRequest,
  ): Promise<ProviderSynthesisResult>;
}

export type ArticleAudioRuntimeConfig = {
  generationEnabled: boolean;
  disabledReason:
    | "FEATURE_DISABLED"
    | "GLOBAL_KILL"
    | "DEMO_MODE"
    | "DEPENDENCY_DISABLED"
    | null;
  browserFallbackEnabled: boolean;
  providerOrder: readonly ServerAudioProvider[];
  providers: ReadonlyMap<ServerAudioProvider, ProviderConfiguration>;
  dailyBudgetMicros: number;
  perArticleBudgetMicros: number;
  maximumArticleCharacters: number;
  regenerationCooldownSeconds: number;
  narrationPolicyVersion: string;
  storageBucket: string | null;
  storagePrefix: string;
  downloadAllowed: boolean;
};

export type ArticleAudioRecord = {
  id: string;
  articleId: string;
  articleVersionId: string;
  variant: ArticleAudioVariant;
  state: ArticleAudioState;
  inputHash: string;
  provider: ServerAudioProvider | null;
  modelId: string | null;
  voiceId: string | null;
  characterCount: number;
  chunkCount: number;
  generationAttempt: number;
  estimatedCostMicros: number;
  actualCostMicros: number | null;
  storageKey: string | null;
  contentType: string | null;
  durationMs: number | null;
  cooldownUntil: Date | null;
  queueJobId: string | null;
  requestedAt: Date | null;
  updatedAt: Date;
};

export type PublicArticleAudio = {
  state: ArticleAudioState;
  variant: ArticleAudioVariant;
  durationMs: number | null;
  streamUrl: string | null;
  chapters: readonly AudioChapterTiming[];
  timings: readonly AudioTiming[];
  disclosure: "AI-generated narration";
  downloadAllowed: boolean;
  degradedBrowserFallbackAvailable: boolean;
};

export type AudioGenerationPlan =
  | {
      outcome: "DISABLED";
      reason: NonNullable<ArticleAudioRuntimeConfig["disabledReason"]>;
    }
  | {
      outcome: "REPLAY";
      audio: ArticleAudioRecord;
    }
  | {
      outcome: "COOLDOWN";
      audio: ArticleAudioRecord;
      retryAt: Date;
    }
  | {
      outcome: "REJECT";
      reason:
        | "ARTICLE_NOT_PUBLISHED"
        | "ARTICLE_TOO_LONG"
        | "NO_PROVIDER"
        | "PER_ARTICLE_BUDGET"
        | "DAILY_BUDGET";
      characterCount: number;
    }
  | {
      outcome: "QUEUE";
      document: NarrationDocument;
      provider: ProviderConfiguration;
      estimatedCostMicros: number;
      markExistingStale: boolean;
    };
