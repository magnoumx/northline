export type ArticleAudioErrorCode =
  | "FEATURE_DISABLED"
  | "CONFIGURATION_INVALID"
  | "ARTICLE_NOT_FOUND"
  | "ARTICLE_NOT_PUBLISHED"
  | "ARTICLE_VERSION_CONFLICT"
  | "STATE_CONFLICT"
  | "BUDGET_EXCEEDED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_REJECTED"
  | "PROVIDER_TIMEOUT"
  | "POST_PROCESSING_UNAVAILABLE"
  | "STORAGE_UNAVAILABLE"
  | "CLIENT_ONLY_FALLBACK";

export class ArticleAudioError extends Error {
  constructor(
    readonly code: ArticleAudioErrorCode,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ArticleAudioError";
  }
}
