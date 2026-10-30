import { redactSecretsFromModelContext } from "../security/ai-boundary";
import { sha256Base64Url } from "../security/crypto";
import {
  resolveAiRuntimeConfiguration,
  type AiEnvironment,
  type AiRuntimeConfiguration,
} from "./config";
import {
  AiRuntimeError,
  toSafeAiError,
  type AiProviderAttemptFailure,
} from "./errors";
import { fingerprintPrompt } from "./prompt-version";
import { createAiProviderAdapters } from "./providers";
import type { AiProviderDependencies } from "./providers";
import {
  parseStructuredOutput,
  toProviderJsonSchema,
} from "./structured-output";
import type {
  AiCapability,
  AiCapabilityGateway,
  AiProviderAdapter,
  AiProviderId,
  AiRuntimeLogger,
  AiTaskRequest,
  AiTaskResult,
  AiUsage,
} from "./types";
import type { z } from "zod";

const SAFE_TASK_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

export interface AiGatewayDependencies extends AiProviderDependencies {
  readonly environment?: AiEnvironment;
  readonly configuration?: AiRuntimeConfiguration;
  readonly providers?: readonly AiProviderAdapter[];
  readonly logger?: AiRuntimeLogger;
}

export class AiGateway implements AiCapabilityGateway {
  private readonly configuration: AiRuntimeConfiguration;
  private readonly providers: readonly AiProviderAdapter[];
  private readonly logger: AiRuntimeLogger;

  constructor(dependencies: AiGatewayDependencies = {}) {
    this.configuration =
      dependencies.configuration ??
      resolveAiRuntimeConfiguration(dependencies.environment);
    this.providers =
      dependencies.providers ??
      createAiProviderAdapters(this.configuration.providers, dependencies);
    this.logger = dependencies.logger ?? (() => undefined);
  }

  async execute<TSchema extends z.ZodType>(
    request: AiTaskRequest<TSchema>,
  ): Promise<AiTaskResult<z.output<TSchema>>> {
    this.assertOperational();
    validateTaskRequest(request);

    const startedAt = new Date().toISOString();
    const promptHash = await fingerprintPrompt(
      request.prompt,
      request.schemaName,
    );
    const protectedSystemPrompt = redactSecretsFromModelContext(
      request.prompt.systemTemplate,
    );
    const protectedUserInput = redactSecretsFromModelContext(request.userInput);
    const inputContentHash = await sha256Base64Url(protectedUserInput);
    const policyVersion = request.policyVersion?.trim() || "unspecified";
    this.logger({
      type: "task_started",
      taskId: request.taskId,
      capability: request.capability,
      promptHash,
      inputContentHash,
      policyVersion,
      startedAt,
    });
    const estimatedInputTokens = estimateTokens(
      `${protectedSystemPrompt}\n${protectedUserInput}`,
    );
    if (estimatedInputTokens > request.budget.maxInputTokens) {
      throw new AiRuntimeError(
        "AI_BUDGET_EXCEEDED",
        "The estimated input exceeds the task input-token budget.",
      );
    }

    const candidates = this.orderedCandidates(request);
    if (candidates.length === 0) {
      throw new AiRuntimeError(
        "AI_NO_PROVIDER_AVAILABLE",
        "No healthy configured provider supports this capability within budget.",
      );
    }

    const attemptedProviders: AiProviderId[] = [];
    const attemptFailures: AiProviderAttemptFailure[] = [];
    let spentUsd = 0;
    let lastError: AiRuntimeError | undefined;

    for (const provider of candidates) {
      const selectedModel =
        request.preferredModels?.[provider.id]?.trim() || provider.model;
      const remainingCostUsd = request.budget.maxCostUsd - spentUsd;
      const maximumAttemptCost = calculateCost(
        {
          inputTokens: estimatedInputTokens,
          outputTokens: request.budget.maxOutputTokens,
        },
        provider.pricing,
      );
      if (maximumAttemptCost > remainingCostUsd) {
        attemptFailures.push({ provider: provider.id, code: "SKIPPED_OVER_BUDGET" });
        continue;
      }

      attemptedProviders.push(provider.id);
      this.logger({
        type: "provider_attempted",
        taskId: request.taskId,
        provider: provider.id,
        model: selectedModel,
      });
      try {
        let response = await provider.complete({
          capability: request.capability,
          modelOverride: selectedModel,
          systemPrompt: protectedSystemPrompt,
          userPrompt: protectedUserInput,
          schemaName: request.schemaName,
          jsonSchema: toProviderJsonSchema(request.outputSchema),
          maxOutputTokens: request.budget.maxOutputTokens,
          temperature: request.temperature ?? 0,
          signal: request.signal,
        });
        spentUsd += calculateCost(response.usage, provider.pricing);
        logSoftBudgetOverage(
          response.usage,
          spentUsd,
          request,
        );

        let data: z.output<TSchema>;
        try {
          data = parseStructuredOutput(response.text, request.outputSchema);
        } catch (error) {
          const structuredError = toSafeAiError(error);
          const canRepair =
            structuredError.code === "AI_STRUCTURED_OUTPUT_INVALID" &&
            provider.id === "anthropic" &&
            request.capability === "research_synthesis" &&
            !request.signal?.aborted;

          if (!canRepair) throw error;

          const repairResponse = await provider.complete({
            capability: "extract",
            modelOverride: selectedModel,
            systemPrompt:
              "Convert the completed research response into exactly one JSON document matching the supplied schema. Do not browse the web again. Preserve exact HTTPS source URLs and supported facts from the completed research. Do not invent missing facts, sources, names, dates, numbers, or quotes. Put unresolved details in uncertainty fields allowed by the schema. Return JSON only, with no Markdown fences, commentary, or source appendix outside the JSON document.",
            userPrompt: JSON.stringify({
              originalTask: protectedUserInput,
              completedResearchResponse: response.text,
            }),
            schemaName: `${request.schemaName}_repair`,
            jsonSchema: toProviderJsonSchema(request.outputSchema),
            maxOutputTokens: request.budget.maxOutputTokens,
            temperature: 0,
            signal: request.signal,
          });

          spentUsd += calculateCost(repairResponse.usage, provider.pricing);
          response = {
            text: repairResponse.text,
            usage: {
              inputTokens:
                response.usage.inputTokens + repairResponse.usage.inputTokens,
              outputTokens:
                response.usage.outputTokens + repairResponse.usage.outputTokens,
            },
            requestId: repairResponse.requestId ?? response.requestId,
          };
          logSoftBudgetOverage(
            response.usage,
            spentUsd,
            request,
          );
          data = parseStructuredOutput(response.text, request.outputSchema);
        }
        const endedAt = new Date().toISOString();
        this.logger({
          type: "task_completed",
          taskId: request.taskId,
          provider: provider.id,
          model: selectedModel,
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          costUsd: spentUsd,
          promptHash,
          inputContentHash,
          policyVersion,
          startedAt,
          endedAt,
          retryCount: Math.max(0, attemptedProviders.length - 1),
        });
        return {
          data,
          metadata: {
            provider: provider.id,
            model: selectedModel,
            promptId: request.prompt.id,
            promptVersion: request.prompt.version,
            policyVersion,
            promptHash,
            inputContentHash,
            startedAt,
            endedAt,
            usage: response.usage,
            costUsd: spentUsd,
            retryCount: Math.max(0, attemptedProviders.length - 1),
            structuredOutputValid: true,
            evidenceIds: request.evidenceIds ?? [],
            resultDisposition: "COMPLETED",
            requestId: response.requestId,
            attemptedProviders,
            groundedSourceUrls: response.groundedSourceUrls ?? [],
            groundingSearchQueries: response.groundingSearchQueries ?? [],
          },
        };
      } catch (error) {
        lastError = toSafeAiError(error);
        attemptFailures.push({
          provider: provider.id,
          code: lastError.code,
          ...(lastError.quotaScope ? { quotaScope: lastError.quotaScope } : {}),
        });
        lastError.attempts = [...attemptFailures];
        this.logger({
          type: "provider_failed",
          taskId: request.taskId,
          provider: provider.id,
          code: lastError.code,
        });
        if (
          lastError.code === "AI_BUDGET_EXCEEDED" ||
          lastError.code === "AI_PROVIDER_RESPONSE_INVALID" ||
          lastError.code === "AI_PROVIDER_TIMEOUT" ||
          request.signal?.aborted
        ) {
          throw lastError;
        }
      }
    }

    throw (
      lastError ??
      new AiRuntimeError(
        "AI_NO_PROVIDER_AVAILABLE",
        "No configured provider could complete the task within budget.",
      )
    );
  }

  health() {
    return this.providers.map((provider) => ({
      provider: provider.id,
      model: provider.model,
      ...provider.health(),
    }));
  }

  private assertOperational(): void {
    if (!this.configuration.enabled) {
      throw new AiRuntimeError("AI_DISABLED", "The AI runtime is disabled.");
    }
    if (this.configuration.globalKill) {
      throw new AiRuntimeError(
        "AI_KILL_SWITCH_ACTIVE",
        "The AI runtime global kill switch is active.",
      );
    }
  }

  private orderedCandidates<TSchema extends z.ZodType>(
    request: AiTaskRequest<TSchema>,
  ): readonly AiProviderAdapter[] {
    const preferred =
      request.preferredProviders ?? this.configuration.providerOrder;
    const order = new Map(preferred.map((provider, index) => [provider, index]));
    return this.providers
      .filter(
        (provider) =>
          provider.capabilities.has(request.capability) &&
          provider.health().state !== "open",
      )
      .filter(
        (provider) =>
          provider.tier === "paid" ||
          allowsFreePublicDraftingProvider(provider, request),
      )
      .filter((provider) => {
        const maximumCost = calculateCost(
          {
            inputTokens: request.budget.maxInputTokens,
            outputTokens: request.budget.maxOutputTokens,
          },
          provider.pricing,
        );
        return maximumCost <= request.budget.maxCostUsd;
      })
      .toSorted(
        (left, right) =>
          (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
            (order.get(right.id) ?? Number.MAX_SAFE_INTEGER) ||
          calculateCost(
            {
              inputTokens: request.budget.maxInputTokens,
              outputTokens: request.budget.maxOutputTokens,
            },
            left.pricing,
          ) -
            calculateCost(
              {
                inputTokens: request.budget.maxInputTokens,
                outputTokens: request.budget.maxOutputTokens,
              },
              right.pricing,
            ),
      );
  }
}


function allowsFreePublicDraftingProvider<TSchema extends z.ZodType>(
  provider: AiProviderAdapter,
  request: AiTaskRequest<TSchema>,
): boolean {
  if (
    provider.id !== "google" ||
    provider.tier !== "free" ||
    request.dataClass !== "PUBLIC"
  ) {
    return false;
  }

  // Free-tier Gemini may prepare public-data editorial material in both the
  // assistive newsroom and the autonomous pipeline, but it may never serve as
  // the final publication fact reviewer. Auto-publication still requires the
  // paid Claude Haiku fact-review route plus deterministic source, claim, risk,
  // quality, and rights gates.
  const freeDraftingCapabilities: ReadonlySet<AiCapability> = new Set([
    "classify",
    "extract",
    "research_synthesis",
    "outline",
    "draft",
    "copy_review",
    "seo_review",
    "summarize",
  ]);

  return freeDraftingCapabilities.has(request.capability);
}

export function createAiGateway(
  dependencies: AiGatewayDependencies = {},
): AiGateway {
  return new AiGateway(dependencies);
}

export function calculateCost(
  usage: Pick<AiUsage, "inputTokens" | "outputTokens">,
  pricing: {
    inputUsdPerMillionTokens: number;
    outputUsdPerMillionTokens: number;
  },
): number {
  return (
    (usage.inputTokens * pricing.inputUsdPerMillionTokens +
      usage.outputTokens * pricing.outputUsdPerMillionTokens) /
    1_000_000
  );
}

export function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(new TextEncoder().encode(value).length / 4));
}

function validateTaskRequest<TSchema extends z.ZodType>(
  request: AiTaskRequest<TSchema>,
): void {
  if (
    !SAFE_TASK_ID.test(request.taskId) ||
    !request.userInput.trim() ||
    request.userInput.length > 500_000 ||
    !Number.isInteger(request.budget.maxInputTokens) ||
    request.budget.maxInputTokens < 1 ||
    !Number.isInteger(request.budget.maxOutputTokens) ||
    request.budget.maxOutputTokens < 1 ||
    request.budget.maxOutputTokens > 100_000 ||
    !Number.isFinite(request.budget.maxCostUsd) ||
    request.budget.maxCostUsd <= 0 ||
    (request.temperature !== undefined &&
      (!Number.isFinite(request.temperature) ||
        request.temperature < 0 ||
        request.temperature > 2)) ||
    (request.revision !== undefined &&
      (!Number.isInteger(request.revision) || request.revision < 1)) ||
    (request.storyId !== undefined &&
      (!request.storyId.trim() || request.storyId.length > 200))
  ) {
    throw new AiRuntimeError(
      "AI_INPUT_INVALID",
      "The AI task request is invalid or outside safe bounds.",
    );
  }
}

function logSoftBudgetOverage<TSchema extends z.ZodType>(
  usage: AiUsage,
  spentUsd: number,
  request: AiTaskRequest<TSchema>,
): void {
  if (
    usage.inputTokens <= request.budget.maxInputTokens &&
    usage.outputTokens <= request.budget.maxOutputTokens &&
    spentUsd <= request.budget.maxCostUsd
  ) {
    return;
  }
  console.warn("AI_BUDGET_SOFT_LIMIT_EXCEEDED", {
    taskId: request.taskId,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    spentUsd,
    configuredMaxInputTokens: request.budget.maxInputTokens,
    configuredMaxOutputTokens: request.budget.maxOutputTokens,
    configuredMaxCostUsd: request.budget.maxCostUsd,
    action: "preserving_completed_paid_result",
  });
}
