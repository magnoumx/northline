import type { z } from "zod";

export const AI_PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "local",
] as const;

export type AiProviderId = (typeof AI_PROVIDERS)[number];

export type AiProviderTier = "paid" | "free" | "unknown";
export type AiTaskRisk = "low" | "high";
export type AiPublicationMode = "assistive" | "auto_publish";

export const AI_CAPABILITIES = [
  "classify",
  "summarize",
  "extract",
  "research_synthesis",
  "outline",
  "draft",
  "fact_review",
  "copy_review",
  "seo_review",
] as const;

export type AiCapability = (typeof AI_CAPABILITIES)[number];

export interface AiPricing {
  readonly inputUsdPerMillionTokens: number;
  readonly outputUsdPerMillionTokens: number;
}

export interface AiUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface AiTaskBudget {
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
  readonly maxCostUsd: number;
}

export interface AiPromptDefinition {
  readonly id: string;
  readonly version: string;
  readonly systemTemplate: string;
}

export interface AiProviderRequest {
  readonly capability: AiCapability;
  readonly modelOverride?: string;
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly schemaName: string;
  readonly jsonSchema?: unknown;
  readonly maxOutputTokens: number;
  readonly temperature: number;
  readonly signal?: AbortSignal;
}

export interface AiProviderResponse {
  readonly text: string;
  readonly usage: AiUsage;
  readonly requestId?: string;
  readonly groundedSourceUrls?: readonly string[];
  readonly groundingSearchQueries?: readonly string[];
}

export interface AiProviderHealth {
  readonly state: "closed" | "open" | "half_open";
  readonly consecutiveFailures: number;
  readonly retryAt?: string;
}

export interface AiProviderAdapter {
  readonly id: AiProviderId;
  readonly model: string;
  readonly pricing: AiPricing;
  readonly capabilities: ReadonlySet<AiCapability>;
  /**
   * Unknown is intentionally treated like a free tier for high-risk work.
   * A provider must be explicitly marked paid before it can enter that route.
   */
  readonly tier?: AiProviderTier;
  complete(request: AiProviderRequest): Promise<AiProviderResponse>;
  health(): AiProviderHealth;
}

export interface AiTaskRequest<TSchema extends z.ZodType> {
  readonly taskId: string;
  readonly capability: AiCapability;
  readonly prompt: AiPromptDefinition;
  readonly userInput: string;
  readonly outputSchema: TSchema;
  readonly schemaName: string;
  readonly budget: AiTaskBudget;
  readonly policyVersion?: string;
  readonly dataClass?: string;
  readonly evidenceIds?: readonly string[];
  readonly preferredProviders?: readonly AiProviderId[];
  readonly preferredModels?: Readonly<Partial<Record<AiProviderId, string>>>;
  readonly risk?: AiTaskRisk;
  readonly publicationMode?: AiPublicationMode;
  readonly storyId?: string;
  readonly revision?: number;
  readonly temperature?: number;
  readonly signal?: AbortSignal;
}

export interface AiTaskMetadata {
  readonly provider: AiProviderId;
  readonly model: string;
  readonly promptId: string;
  readonly promptVersion: string;
  readonly policyVersion: string;
  readonly promptHash: string;
  readonly inputContentHash: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly usage: AiUsage;
  readonly costUsd: number;
  readonly retryCount: number;
  readonly structuredOutputValid: true;
  readonly evidenceIds: readonly string[];
  readonly resultDisposition: "COMPLETED";
  readonly requestId?: string;
  readonly attemptedProviders: readonly AiProviderId[];
  readonly groundedSourceUrls: readonly string[];
  readonly groundingSearchQueries: readonly string[];
}

export interface AiTaskResult<T> {
  readonly data: T;
  readonly metadata: AiTaskMetadata;
}

export interface AiGatewayProviderHealth extends AiProviderHealth {
  readonly provider: AiProviderId;
  readonly model: string;
}

/**
 * Stable boundary for editorial stages. Each call performs one discrete
 * capability; orchestration and human approval remain outside the AI runtime.
 */
export interface AiCapabilityGateway {
  execute<TSchema extends z.ZodType>(
    request: AiTaskRequest<TSchema>,
  ): Promise<AiTaskResult<z.output<TSchema>>>;
  health(): readonly AiGatewayProviderHealth[];
}

export type AiRuntimeEvent =
  | {
      readonly type: "task_started";
      readonly taskId: string;
      readonly capability: AiCapability;
      readonly promptHash: string;
      readonly inputContentHash: string;
      readonly policyVersion: string;
      readonly startedAt: string;
    }
  | {
      readonly type: "provider_attempted";
      readonly taskId: string;
      readonly provider: AiProviderId;
      readonly model: string;
    }
  | {
      readonly type: "provider_failed";
      readonly taskId: string;
      readonly provider: AiProviderId;
      readonly code: string;
    }
  | {
      readonly type: "task_completed";
      readonly taskId: string;
      readonly provider: AiProviderId;
      readonly model: string;
      readonly inputTokens: number;
      readonly outputTokens: number;
      readonly costUsd: number;
      readonly promptHash: string;
      readonly inputContentHash: string;
      readonly policyVersion: string;
      readonly startedAt: string;
      readonly endedAt: string;
      readonly retryCount: number;
    };

export type AiRuntimeLogger = (event: AiRuntimeEvent) => void;
