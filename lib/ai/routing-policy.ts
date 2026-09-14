import { AiRuntimeError } from "./errors";
import type { AiTaskBudget } from "./types";

export type AiBudgetEnvironment = Record<string, string | undefined>;

export interface AiCostControls {
  readonly enabled: boolean;
  readonly monthlyBudgetUsd: number;
  readonly perStoryBudgetUsd: number;
  readonly perTaskBudgetUsd: number;
  readonly maxContextTokens: number;
  readonly maxOutputTokens: number;
  readonly maxRevisions: number;
  readonly maxRetries: number;
  readonly maxConcurrentJobs: number;
}

export interface AiSpendSnapshot {
  readonly monthlySpendUsd: number;
  readonly storySpendUsd: number;
  readonly activeJobs: number;
}

export interface AiAdmissionRequest {
  readonly storyId: string;
  readonly revision: number;
  readonly estimatedInputTokens: number;
  readonly taskBudget: AiTaskBudget;
}

/**
 * Parses the global portfolio guardrails used before a task reaches a
 * provider. Disabled AI intentionally resolves to zero-capacity limits.
 */
export function resolveAiCostControls(
  environment: AiBudgetEnvironment = process.env,
): AiCostControls {
  const enabled =
    environment.AI_ENABLED === "true" &&
    environment.AI_GLOBAL_KILL === "false";
  if (!enabled) {
    return {
      enabled: false,
      monthlyBudgetUsd: 0,
      perStoryBudgetUsd: 0,
      perTaskBudgetUsd: 0,
      maxContextTokens: 0,
      maxOutputTokens: 0,
      maxRevisions: 0,
      maxRetries: 0,
      maxConcurrentJobs: 0,
    };
  }
  return {
    enabled: true,
    monthlyBudgetUsd: requiredPositive(
      environment.AI_MONTHLY_BUDGET_USD,
      "AI_MONTHLY_BUDGET_USD",
    ),
    perStoryBudgetUsd: requiredPositive(
      environment.AI_PER_STORY_BUDGET_USD,
      "AI_PER_STORY_BUDGET_USD",
    ),
    perTaskBudgetUsd: requiredPositive(
      environment.AI_PER_TASK_BUDGET_USD,
      "AI_PER_TASK_BUDGET_USD",
    ),
    maxContextTokens: requiredInteger(
      environment.AI_MAX_CONTEXT_TOKENS,
      "AI_MAX_CONTEXT_TOKENS",
      1,
      2_000_000,
    ),
    maxOutputTokens: requiredInteger(
      environment.AI_MAX_OUTPUT_TOKENS,
      "AI_MAX_OUTPUT_TOKENS",
      1,
      250_000,
    ),
    maxRevisions: requiredInteger(
      environment.AI_MAX_REVISIONS,
      "AI_MAX_REVISIONS",
      1,
      100,
    ),
    maxRetries: requiredInteger(
      environment.AI_MAX_RETRIES,
      "AI_MAX_RETRIES",
      0,
      10,
    ),
    maxConcurrentJobs: requiredInteger(
      environment.AI_MAX_CONCURRENT_JOBS,
      "AI_MAX_CONCURRENT_JOBS",
      1,
      100,
    ),
  };
}

/**
 * Stateless admission gate. Durable spend and active-job counts are injected
 * from the ledger/queue so Worker restarts cannot reset the budget.
 */
export class AiAdmissionController {
  constructor(private readonly controls: AiCostControls) {}

  authorize(
    request: AiAdmissionRequest,
    snapshot: AiSpendSnapshot,
  ): void {
    if (!this.controls.enabled) {
      throw new AiRuntimeError("AI_DISABLED", "The AI runtime is disabled.");
    }
    if (!request.storyId.trim() || request.revision < 1) {
      throw new AiRuntimeError(
        "AI_INPUT_INVALID",
        "A valid story and revision are required for AI admission.",
      );
    }
    if (
      request.revision > this.controls.maxRevisions ||
      request.estimatedInputTokens > this.controls.maxContextTokens ||
      request.taskBudget.maxInputTokens > this.controls.maxContextTokens ||
      request.taskBudget.maxOutputTokens > this.controls.maxOutputTokens ||
      request.taskBudget.maxCostUsd > this.controls.perTaskBudgetUsd ||
      snapshot.monthlySpendUsd + request.taskBudget.maxCostUsd >
        this.controls.monthlyBudgetUsd ||
      snapshot.storySpendUsd + request.taskBudget.maxCostUsd >
        this.controls.perStoryBudgetUsd ||
      snapshot.activeJobs >= this.controls.maxConcurrentJobs
    ) {
      throw new AiRuntimeError(
        "AI_BUDGET_EXCEEDED",
        "The task exceeds an AI cost, context, revision, or concurrency guardrail.",
      );
    }
  }
}

function requiredPositive(
  value: string | undefined,
  key: string,
): number {
  const parsed = Number(value);
  if (!value?.trim() || !Number.isFinite(parsed) || parsed <= 0) {
    configurationError(`${key} must be a positive number when AI is enabled.`);
  }
  return parsed;
}

function requiredInteger(
  value: string | undefined,
  key: string,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  if (
    !value?.trim() ||
    !Number.isInteger(parsed) ||
    parsed < minimum ||
    parsed > maximum
  ) {
    configurationError(
      `${key} must be an integer from ${minimum} through ${maximum} when AI is enabled.`,
    );
  }
  return parsed;
}

function configurationError(message: string): never {
  throw new AiRuntimeError("AI_CONFIGURATION_INVALID", message);
}
