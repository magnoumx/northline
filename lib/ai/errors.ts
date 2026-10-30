export type AiRuntimeErrorCode =
  | "AI_DISABLED"
  | "AI_KILL_SWITCH_ACTIVE"
  | "AI_CONFIGURATION_INVALID"
  | "AI_NO_PROVIDER_AVAILABLE"
  | "AI_BUDGET_EXCEEDED"
  | "AI_INPUT_INVALID"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_PROVIDER_TIMEOUT"
  | "AI_PROVIDER_RATE_LIMITED"
  | "AI_PROVIDER_NO_CREDIT"
  | "AI_PROVIDER_INVALID_KEY"
  | "AI_PROVIDER_CONTEXT_LIMIT"
  | "AI_PROVIDER_BAD_OUTPUT"
  | "AI_PROVIDER_MODEL_UNAVAILABLE"
  | "AI_PROVIDER_MODERATION_REJECTION"
  | "AI_PROVIDER_REJECTED"
  | "AI_PROVIDER_RESPONSE_INVALID"
  | "AI_STRUCTURED_OUTPUT_INVALID"
  | "AI_CIRCUIT_OPEN";

export type AiProviderAttemptFailure = {
  provider: string;
  code: AiRuntimeErrorCode | "SKIPPED_OVER_BUDGET";
  quotaScope?: "daily" | "short";
  /**
   * What the provider said, for failures other than rate limits. On
   * 2026-10-30 Anthropic rejected a research call and Google then hit its
   * quota; the run kept Google's message and Anthropic's reason was lost.
   */
  detail?: string;
};

export class AiRuntimeError extends Error {
  /**
   * How long the provider asked us to wait, when it said so. Retrying a
   * rate-limited request after the default 125ms only spends another request
   * against the same exhausted quota.
   */
  retryAfterMs?: number;
  /** The adapter that raised the error, so a cooldown names who to wait for. */
  provider?: string;
  /**
   * For rate limits: "daily" when the provider says a per-day quota is spent.
   * Waiting an hour and asking again cannot succeed until the quota resets.
   */
  quotaScope?: "daily" | "short";
  /**
   * Every provider the gateway tried before giving up, in order. The run used
   * to keep only the last error, so a chain that failed on its first provider
   * for one reason and its second for another read as the second alone.
   */
  attempts?: AiProviderAttemptFailure[];
  /** What the run had already spent when this error ended it. */
  spentUsd?: number;

  constructor(
    readonly code: AiRuntimeErrorCode,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "AiRuntimeError";
  }
}

export function toSafeAiError(error: unknown): AiRuntimeError {
  if (error instanceof AiRuntimeError) return error;
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return new AiRuntimeError(
      "AI_PROVIDER_TIMEOUT",
      "The AI provider request timed out.",
    );
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return new AiRuntimeError(
      "AI_PROVIDER_TIMEOUT",
      "The AI provider request was aborted.",
    );
  }
  return new AiRuntimeError(
    "AI_PROVIDER_UNAVAILABLE",
    "The AI provider request failed.",
    true,
  );
}
