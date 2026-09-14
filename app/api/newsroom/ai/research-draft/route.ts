import { z } from "zod";
import { getD1Binding } from "@/db";
import { AiRuntimeError, createAiGateway, EditorialAiGateway } from "@/lib/ai";
import {
  authorizeEditorialRequest,
  protectEditorialMutation,
} from "@/lib/newsroom/editorial-api-security";
import {
  readJsonBodyWithLimit,
  RequestBodyTooLargeError,
} from "@/lib/newsletter/body";
import { apiErrorResponse } from "@/lib/security/api";

export const runtime = "edge";

const MAX_BODY = 80_000;
const formats = [
  "NEWS_FLASH",
  "QUICK_BRIEF",
  "STANDARD_NEWS",
  "DEEP_EXPLAINER",
  "LIVE_BLOG",
  "WHY_TRENDING",
  "VISUAL_STORY",
  "SOURCE_COMPARISON",
] as const;

const inputSchema = z
  .object({
    headline: z.string().trim().min(5).max(220),
    category: z.string().trim().min(2).max(80),
    requestedFormat: z.enum(formats).optional(),
    primaryQuery: z.string().trim().min(2).max(240),
    sensitive: z.boolean().default(false),
    instruction: z.string().trim().max(2_000).optional(),
  })
  .strict();

type SourceRegistryRow = {
  id: string;
  name: string;
  domain: string;
  sourceType: string;
  credibilityTier: number;
  isPrimary: number;
  licensingStatus: string;
};

type GeneratedSource = {
  name: string;
  publisher: string;
  url: string;
  domain: string;
  sourceKind: "PRIMARY" | "INDEPENDENT" | "CONTEXT";
  sourceType:
    | "GOVERNMENT"
    | "PRIMARY_DOCUMENT"
    | "COMPANY"
    | "NEWSROOM"
    | "WIRE"
    | "RESEARCH"
    | "EXPERT"
    | "DATASET"
    | "OTHER";
  summary: string;
  supports: string[];
  publishedAt: string | null;
  confidence: number;
};


type GenerationGuardRow = {
  id: string;
  state: "RUNNING" | "COMPLETED" | "FAILED";
  resultJson: string | null;
  errorCode: string | null;
  startedAt: number;
  completedAt: number | null;
  expiresAt: number;
};

export async function POST(request: Request): Promise<Response> {
  const access = await authorizeEditorialRequest([
    "article.create",
    "article.edit.any",
    "source.manage",
  ]);
  if (!access.allowed) return access.response;

  const protection = await protectEditorialMutation(request, access.user);
  if (!protection.allowed) return protection.response;

  let raw: unknown;
  try {
    raw = await readJsonBodyWithLimit(request, MAX_BODY);
  } catch (error) {
    return apiErrorResponse(
      error instanceof RequestBodyTooLargeError
        ? "PAYLOAD_TOO_LARGE"
        : "BAD_REQUEST",
      {
        status: error instanceof RequestBodyTooLargeError ? 413 : 400,
        message: "Send a bounded AI research request.",
      },
    );
  }

  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Review the story topic, format, category, and search query.",
    });
  }

  const hasEnabledResearchProvider =
    process.env.AI_GOOGLE_ENABLED === "true" ||
    process.env.AI_ANTHROPIC_ENABLED === "true" ||
    process.env.AI_OPENAI_ENABLED === "true";

  if (
    process.env.AI_ENABLED !== "true" ||
    process.env.AI_GLOBAL_KILL !== "false" ||
    !hasEnabledResearchProvider
  ) {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "AI research and drafting are disabled by policy.",
    });
  }

  const startedAt = Date.now();
  let database: D1Database | null = null;
  let generationId: string | null = null;

  try {
    const db = await getD1Binding();
    database = db;
    const workflowId = `research_${crypto.randomUUID().replaceAll("-", "")}`;
    const requestKey = await researchRequestKey(parsed.data);
    const guard = await beginGenerationGuard({
      db,
      actorId: access.user.userId,
      workflowId,
      requestKey,
      headline: parsed.data.headline,
      category: parsed.data.category,
      requestedFormat: parsed.data.requestedFormat ?? "AUTO",
    });
    if (guard.cachedPackage) {
      return Response.json(
        {
          draftPackage: guard.cachedPackage,
          cache: { hit: true, generationId: guard.generationId },
        },
        {
          status: 200,
          headers: { "cache-control": "private, no-store" },
        },
      );
    }
    if (guard.running) {
      return apiErrorResponse("CONFLICT", {
        status: 409,
        message:
          "Research for this topic is already running. Wait a few minutes instead of starting another paid request.",
      });
    }
    if (guard.cooldownUntil) {
      const retryMinutes = Math.max(
        1,
        Math.ceil((guard.cooldownUntil - Date.now()) / 60_000),
      );
      return apiErrorResponse("RATE_LIMITED", {
        status: 429,
        message: `A paid request for this topic failed recently. Northline blocked another charge. Retry in about ${retryMinutes} minutes or change to a narrower QUICK_BRIEF topic.`,
      });
    }
    generationId = guard.generationId;
    const registryResult = await db
      .prepare(
        `SELECT id, name, domain, source_type AS sourceType,
          credibility_tier AS credibilityTier, is_primary AS isPrimary,
          licensing_status AS licensingStatus
         FROM sources
         WHERE licensing_status IN ('approved', 'review_required', 'link_only')
         ORDER BY credibility_tier ASC, is_primary DESC, name ASC
         LIMIT 150`,
      )
      .all<SourceRegistryRow>();

    const profile = resolveWordProfile(parsed.data.requestedFormat);
    const registry = selectRelevantSources(
      registryResult.results ?? [],
      parsed.data.category,
      parsed.data.primaryQuery,
      sourceRegistryLimit(profile.format),
    );
    const environment = process.env as Record<string, string | undefined>;
    const gateway = new EditorialAiGateway(
      createAiGateway({ environment }),
      environment,
    );
    const runtimeBudget = resolveGenerationBudget(profile);
    const maxOutputTokens = Math.min(
      positiveInteger(process.env.AI_MAX_OUTPUT_TOKENS, runtimeBudget.maxOutputTokens),
      runtimeBudget.maxOutputTokens,
    );
    const research = await gateway.researchAndDraft({
      taskId: `${workflowId}:research-draft`,
      storyId: workflowId,
      content: {
        topic: parsed.data.headline,
        category: parsed.data.category,
        requestedFormat: parsed.data.requestedFormat ?? "AUTO",
        primaryQuery: parsed.data.primaryQuery,
        sensitive: parsed.data.sensitive,
        operatorInstruction: parsed.data.instruction ?? null,
        wordProfile: profile,
        sourceRequirements: {
          minimumPrimarySources: positiveInteger(
            process.env.AI_MIN_PRIMARY_SOURCES,
            1,
          ),
          minimumIndependentSources: positiveInteger(
            process.env.AI_MIN_INDEPENDENT_SOURCES,
            2,
          ),
          maximumResearchSources: boundedInteger(
            process.env.AI_MAX_RESEARCH_SOURCES,
            8,
            3,
            10,
          ),
          exactHttpsUrlsRequired: true,
          primaryAndIndependentEvidenceRequired: true,
        },
        trustedSourceRegistry: registry.map((source) => ({
          name: source.name,
          domain: source.domain,
          sourceType: source.sourceType,
          credibilityTier: source.credibilityTier,
          isPrimary: source.isPrimary === 1,
          licensingStatus: source.licensingStatus,
        })),
        editorialRules: {
          locale: "en-US",
          voice: "clear, direct, calm, non-partisan",
          originalWritingOnly: true,
          noCopiedPassages: true,
          noInventedQuotes: true,
          noKeywordStuffing: true,
          discloseUncertainty: true,
          humanApprovalRequired: true,
        },
      },
      budget: {
        maxInputTokens: Math.min(
          positiveInteger(
            process.env.AI_MAX_CONTEXT_TOKENS,
            runtimeBudget.maxInputTokens,
          ),
          runtimeBudget.maxInputTokens,
        ),
        maxOutputTokens,
        maxCostUsd: Math.min(
          positiveNumber(
            process.env.AI_PER_STORY_BUDGET_USD,
            runtimeBudget.maxCostUsd,
          ),
          runtimeBudget.maxCostUsd,
        ),
      },
    });

    const minimumPrimary = positiveInteger(
      process.env.AI_MIN_PRIMARY_SOURCES,
      1,
    );
    const minimumIndependent = positiveInteger(
      process.env.AI_MIN_INDEPENDENT_SOURCES,
      2,
    );
    const primarySources = research.data.sources.filter(
      (source) => source.sourceKind === "PRIMARY",
    );
    const independentSources = research.data.sources.filter(
      (source) => source.sourceKind === "INDEPENDENT",
    );

    if (
      primarySources.length < minimumPrimary ||
      independentSources.length < minimumIndependent
    ) {
      throw new AiRuntimeError(
        "AI_PROVIDER_BAD_OUTPUT",
        "The AI could not verify the required primary and independent source mix. Try a narrower query or review the source registry.",
      );
    }

    const persistedSources = await upsertDiscoveredSources({
      db,
      actorId: access.user.userId,
      generated: research.data.sources,
      registry,
    });

    const evidencePacket = research.data.sources.map((source, index) => ({
      id: `evidence_${index + 1}`,
      sourceId:
        persistedSources.find((item) => item.domain === source.domain)?.id ??
        `source_${index + 1}`,
      sourceName: source.name,
      sourceType: source.sourceKind,
      summary: source.summary,
      sourceUrl: source.url,
      supports: source.supports,
    }));
    const claimList = research.data.claims.map((claim) => ({
      id: claim.id,
      text: claim.text,
      importance: claim.importance,
      status: claim.status,
      evidenceIds: evidencePacket
        .filter(() =>
          claim.sourceUrls.some((url) =>
            url.toLowerCase().includes(
              research.data.sources
                .find((source) => source.url === url)
                ?.domain.toLowerCase() ?? "__none__",
            ),
          ),
        )
        .map((evidence) => evidence.id),
    }));

    let factReviewData: {
      findings: Array<{
        claimId: string;
        draftExcerpt: string;
        disposition:
          | "supported"
          | "misstated"
          | "unsupported"
          | "missing_context"
          | "contradicted";
        evidenceIds: string[];
        requiredChange: string | null;
      }>;
      blocking: boolean;
    };
    let factReviewMetadata: {
      provider: string;
      model: string;
      costUsd: number;
    };
    let independentReview = false;
    let factReviewFallback = false;

    try {
      const factReview = await gateway.reviewFacts({
        taskId: `${workflowId}:fact-review`,
        storyId: workflowId,
        content: {
          draft: research.data.article,
          claimList,
          evidencePacket,
          instruction:
            "Run a separate fact-review pass. The draft is not evidence. Flag unsupported, contradicted, or missing-context language.",
        },
        budget: {
          maxInputTokens: Math.min(
            positiveInteger(process.env.AI_MAX_CONTEXT_TOKENS, 80_000),
            80_000,
          ),
          maxOutputTokens: Math.min(3_000, maxOutputTokens),
          maxCostUsd: Math.min(
            positiveNumber(process.env.AI_PER_TASK_BUDGET_USD, 2),
            2,
          ),
        },
      });
      factReviewData = factReview.data;
      factReviewMetadata = {
        provider: factReview.metadata.provider,
        model: factReview.metadata.model,
        costUsd: factReview.metadata.costUsd,
      };
      independentReview =
        factReview.metadata.provider !== research.metadata.provider ||
        factReview.metadata.model !== research.metadata.model;
    } catch (factReviewError) {
      console.error("AI fact review failed after draft completion", factReviewError);
      factReviewFallback = true;
      factReviewData = {
        findings: research.data.claims.map((claim) => ({
          claimId: claim.id,
          draftExcerpt: claim.text,
          disposition:
            claim.status === "supported"
              ? "supported"
              : claim.status === "contradicted"
                ? "contradicted"
                : claim.status === "partially_supported"
                  ? "missing_context"
                  : "unsupported",
          evidenceIds: claimList.find((item) => item.id === claim.id)?.evidenceIds ?? [],
          requiredChange:
            claim.status === "supported"
              ? null
              : "A human editor must verify or revise this claim before publication.",
        })),
        blocking: true,
      };
      factReviewMetadata = {
        provider: "fallback",
        model: "deterministic-claim-status",
        costUsd: 0,
      };
    }

    const selectedProfile = resolveWordProfile(research.data.recommendedFormat);
    const bodyText = articleBodyText(research.data.article.sections);
    const actualWordCount = countWords(bodyText);
    const minimumAcceptable = Math.floor(selectedProfile.minWords * 0.8);
    const blockingQualityFlags = [
      ...(actualWordCount < minimumAcceptable
        ? [`Draft is shorter than the ${selectedProfile.minWords}-word minimum profile.`]
        : []),
      ...(actualWordCount > selectedProfile.maxWords
        ? [`Draft exceeds the ${selectedProfile.maxWords}-word maximum profile.`]
        : []),
      ...(factReviewData.blocking
        ? ["Fact review returned blocking findings."]
        : []),
    ];
    const advisoryFlags = [
      ...(!independentReview
        ? ["Fact review did not use an independent provider/model; human verification remains required."]
        : []),
      ...(factReviewFallback
        ? ["The separate fact-review request failed after the draft completed. The paid draft was preserved, but publication is blocked until human review."]
        : []),
    ];
    const qualityFlags = [...blockingQualityFlags, ...advisoryFlags];
    const totalCostUsd =
      research.metadata.costUsd + factReviewMetadata.costUsd;

    await db
      .prepare(
        `INSERT INTO audit_logs (
          id, actor_id, action, target_type, target_id, decision,
          reason, metadata_json, occurred_at
        ) VALUES (?1, ?2, 'AI_RESEARCH_DRAFT_CREATED', 'AI_WORKFLOW', ?3,
          'ALLOWED', ?4, ?5, ?6)`,
      )
      .bind(
        crypto.randomUUID(),
        access.user.userId,
        workflowId,
        "AI research and draft package created; human approval remains required.",
        JSON.stringify({
          topic: parsed.data.headline,
          format: research.data.recommendedFormat,
          actualWordCount,
          targetWords: research.data.targetWords,
          primarySources: primarySources.length,
          independentSources: independentSources.length,
          blockingFactReview: factReviewData.blocking,
          independentReview,
          costUsd: totalCostUsd,
        }),
        Date.now(),
      )
      .run();

    const draftPackage = {
      workflowId,
      ...research.data,
      sources: research.data.sources.map((source) => ({
        ...source,
        sourceId:
          persistedSources.find((item) => item.domain === source.domain)?.id ??
          null,
      })),
      factReview: factReviewData,
      metrics: {
        actualWordCount,
        targetWords: research.data.targetWords,
        durationMs: Date.now() - startedAt,
        costUsd: totalCostUsd,
        draftingProvider: research.metadata.provider,
        draftingModel: research.metadata.model,
        factReviewProvider: factReviewMetadata.provider,
        factReviewModel: factReviewMetadata.model,
        independentReview,
      },
      qualityFlags,
      readyForHumanReview:
        blockingQualityFlags.length === 0 && !factReviewData.blocking,
      publishableByModel: false as const,
    };

    if (generationId) {
      await completeGenerationGuard(db, generationId, draftPackage, totalCostUsd);
    }

    return Response.json(
      {
        draftPackage,
        cache: { hit: false, generationId },
      },
      {
        status: 201,
        headers: { "cache-control": "private, no-store" },
      },
    );
  } catch (error) {
    console.error("AI research draft failed", error);
    if (database && generationId) {
      await failGenerationGuard(database, generationId, error);
    }
    const message =
      error instanceof AiRuntimeError && error.code === "AI_PROVIDER_TIMEOUT"
        ? "The provider timed out. Northline did not retry the paid request. Try again later or use a narrower QUICK_BRIEF topic."
        : error instanceof Error && process.env.APP_ENV !== "production"
          ? error.message
          : "The AI research and draft package could not be completed.";
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message,
    });
  }
}

async function researchRequestKey(input: {
  headline: string;
  category: string;
  requestedFormat?: string;
  primaryQuery: string;
  sensitive: boolean;
  instruction?: string;
}): Promise<string> {
  const canonical = JSON.stringify({
    headline: input.headline.trim().toLowerCase(),
    category: input.category.trim().toUpperCase(),
    requestedFormat: input.requestedFormat ?? "AUTO",
    primaryQuery: input.primaryQuery.trim().toLowerCase(),
    sensitive: input.sensitive,
    instruction: input.instruction?.trim() ?? null,
  });
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical)),
  );
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function beginGenerationGuard(input: {
  db: D1Database;
  actorId: string;
  workflowId: string;
  requestKey: string;
  headline: string;
  category: string;
  requestedFormat: string;
}): Promise<{
  generationId: string;
  running: boolean;
  cooldownUntil: number | null;
  cachedPackage: Record<string, unknown> | null;
}> {
  const now = Date.now();
  const existing = await input.db
    .prepare(
      `SELECT id, state, result_json AS resultJson, error_code AS errorCode,
        started_at AS startedAt, completed_at AS completedAt,
        expires_at AS expiresAt
       FROM ai_generation_requests WHERE request_key=?1 LIMIT 1`,
    )
    .bind(input.requestKey)
    .first<GenerationGuardRow>();

  if (
    existing?.state === "COMPLETED" &&
    existing.resultJson &&
    existing.expiresAt > now
  ) {
    try {
      return {
        generationId: existing.id,
        running: false,
        cooldownUntil: null,
        cachedPackage: JSON.parse(existing.resultJson) as Record<string, unknown>,
      };
    } catch {
      // A corrupt cache entry is overwritten below.
    }
  }
  if (
    existing?.state === "RUNNING" &&
    existing.startedAt > now - 10 * 60 * 1_000
  ) {
    return {
      generationId: existing.id,
      running: true,
      cooldownUntil: null,
      cachedPackage: null,
    };
  }

  if (
    existing?.state === "FAILED" &&
    existing.completedAt &&
    existing.completedAt > now - 30 * 60 * 1_000
  ) {
    return {
      generationId: existing.id,
      running: false,
      cooldownUntil: existing.completedAt + 30 * 60 * 1_000,
      cachedPackage: null,
    };
  }

  const generationId = existing?.id ?? `ai_generation_${crypto.randomUUID()}`;
  await input.db
    .prepare(
      `INSERT INTO ai_generation_requests (
        id, request_key, actor_id, workflow_id, headline, category,
        requested_format, state, result_json, error_code, error_message,
        actual_cost_micros, started_at, completed_at, expires_at,
        created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'RUNNING', NULL, NULL, NULL,
        0, ?8, NULL, ?9, ?8, ?8)
      ON CONFLICT(request_key) DO UPDATE SET
        actor_id=excluded.actor_id,
        workflow_id=excluded.workflow_id,
        headline=excluded.headline,
        category=excluded.category,
        requested_format=excluded.requested_format,
        state='RUNNING', result_json=NULL, error_code=NULL, error_message=NULL,
        actual_cost_micros=0, started_at=excluded.started_at,
        completed_at=NULL, expires_at=excluded.expires_at,
        updated_at=excluded.updated_at`,
    )
    .bind(
      generationId,
      input.requestKey,
      input.actorId,
      input.workflowId,
      input.headline,
      input.category,
      input.requestedFormat,
      now,
      now + 6 * 60 * 60 * 1_000,
    )
    .run();
  return {
    generationId,
    running: false,
    cooldownUntil: null,
    cachedPackage: null,
  };
}

async function completeGenerationGuard(
  db: D1Database,
  generationId: string,
  draftPackage: unknown,
  costUsd: number,
): Promise<void> {
  const now = Date.now();
  await db
    .prepare(
      `UPDATE ai_generation_requests SET state='COMPLETED', result_json=?1,
        actual_cost_micros=?2, completed_at=?3, expires_at=?4, updated_at=?3
       WHERE id=?5`,
    )
    .bind(
      JSON.stringify(draftPackage),
      Math.max(0, Math.round(costUsd * 1_000_000)),
      now,
      now + 6 * 60 * 60 * 1_000,
      generationId,
    )
    .run();
}

async function failGenerationGuard(
  db: D1Database,
  generationId: string,
  error: unknown,
): Promise<void> {
  const now = Date.now();
  const code = error instanceof AiRuntimeError ? error.code : "AI_REQUEST_FAILED";
  const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown AI failure";
  try {
    await db
      .prepare(
        `UPDATE ai_generation_requests SET state='FAILED', error_code=?1,
          error_message=?2, completed_at=?3, updated_at=?3 WHERE id=?4`,
      )
      .bind(code, message, now, generationId)
      .run();
  } catch (persistError) {
    console.error("AI generation failure could not be persisted", persistError);
  }
}

function selectRelevantSources(
  registry: SourceRegistryRow[],
  category: string,
  query: string,
  limit: number,
): SourceRegistryRow[] {
  const categoryDomains: Record<string, string[]> = {
    POLITICS: ["whitehouse.gov", "congress.gov", "federalregister.gov", "supremecourt.gov", "fec.gov"],
    TECHNOLOGY: ["cisa.gov", "ftc.gov", "fcc.gov", "nist.gov", "sec.gov", "theverge.com", "arstechnica.com"],
    BUSINESS: ["sec.gov", "federalreserve.gov", "bls.gov", "bea.gov", "reuters.com", "apnews.com"],
    FINANCE: ["sec.gov", "federalreserve.gov", "treasury.gov", "bls.gov", "reuters.com"],
    HEALTH: ["cdc.gov", "fda.gov", "nih.gov", "who.int", "reuters.com", "apnews.com"],
    SCIENCE: ["nasa.gov", "noaa.gov", "usgs.gov", "nsf.gov", "science.org"],
    WEATHER: ["weather.gov", "noaa.gov", "nasa.gov", "usgs.gov", "fema.gov"],
    SPORTS: ["espn.com", "apnews.com", "reuters.com"],
    ENTERTAINMENT: ["apnews.com", "reuters.com", "npr.org", "bbc.com"],
    WORLD: ["state.gov", "un.org", "reuters.com", "apnews.com", "bbc.com"],
    US_NEWS: ["usa.gov", "justice.gov", "fema.gov", "reuters.com", "apnews.com", "npr.org"],
  };
  const preferred = new Set(
    categoryDomains[category.toUpperCase()] ?? categoryDomains.US_NEWS ?? [],
  );
  const queryTokens = query.toLowerCase().split(/[^a-z0-9]+/u).filter((token) => token.length >= 4);
  return registry
    .map((source) => {
      let score = source.isPrimary === 1 ? 20 : 10;
      if (source.credibilityTier <= 2) score += 10;
      if (preferred.has(source.domain)) score += 50;
      if (queryTokens.some((token) => source.name.toLowerCase().includes(token) || source.domain.includes(token))) {
        score += 25;
      }
      return { source, score };
    })
    .sort((left, right) => right.score - left.score || left.source.name.localeCompare(right.source.name))
    .slice(0, limit)
    .map((entry) => entry.source);
}

function sourceRegistryLimit(format: string): number {
  if (format === "QUICK_BRIEF" || format === "NEWS_FLASH") return 12;
  if (format === "DEEP_EXPLAINER" || format === "SOURCE_COMPARISON") {
    return 24;
  }
  if (format === "WHY_TRENDING") return 16;
  return 18;
}

function resolveGenerationBudget(profile: {
  format: string;
  minWords: number;
  targetWords: number;
  maxWords: number;
}): { maxInputTokens: number; maxOutputTokens: number; maxCostUsd: number } {
  if (profile.format === "QUICK_BRIEF" || profile.format === "NEWS_FLASH") {
    return {
      maxInputTokens: 150_000,
      maxOutputTokens: 8_000,
      maxCostUsd: 2.5,
    };
  }
  if (
    profile.format === "DEEP_EXPLAINER" ||
    profile.format === "SOURCE_COMPARISON"
  ) {
    return {
      maxInputTokens: 400_000,
      maxOutputTokens: 20_000,
      maxCostUsd: 10,
    };
  }
  if (profile.format === "WHY_TRENDING") {
    return {
      maxInputTokens: 200_000,
      maxOutputTokens: 10_000,
      maxCostUsd: 4,
    };
  }
  return {
    maxInputTokens: 250_000,
    maxOutputTokens: 12_000,
    maxCostUsd: 5,
  };
}

function resolveWordProfile(requestedFormat?: (typeof formats)[number]) {
  if (!requestedFormat) {
    return {
      format: "AUTO",
      minWords: 800,
      targetWords: 1_500,
      maxWords: 4_000,
      automaticSelectionRules: [
        "QUICK_BRIEF for a narrow event, score, announcement, or simple trend.",
        "STANDARD_NEWS for a material current event with several verified facts.",
        "DEEP_EXPLAINER for complex context, policy, science, business, or consequences.",
        "WHY_TRENDING for a search or social topic whose popularity itself needs explanation.",
      ],
      configuredProfiles: {
        QUICK_BRIEF: { minWords: 650, targetWords: 900, maxWords: 1_200 },
        STANDARD_NEWS: { minWords: 1_200, targetWords: 1_500, maxWords: 2_000 },
        DEEP_EXPLAINER: { minWords: 2_200, targetWords: 3_000, maxWords: 4_000 },
        WHY_TRENDING: { minWords: 1_000, targetWords: 1_400, maxWords: 1_800 },
      },
    };
  }
  const selected = requestedFormat;
  if (selected === "QUICK_BRIEF" || selected === "NEWS_FLASH") {
    return {
      format: selected,
      minWords: boundedInteger(
        process.env.AI_QUICK_BRIEF_MIN_WORDS,
        650,
        250,
        1_500,
      ),
      targetWords: boundedInteger(
        process.env.AI_QUICK_BRIEF_TARGET_WORDS,
        900,
        300,
        1_800,
      ),
      maxWords: boundedInteger(
        process.env.AI_QUICK_BRIEF_MAX_WORDS,
        1_200,
        350,
        2_000,
      ),
    };
  }
  if (selected === "DEEP_EXPLAINER" || selected === "SOURCE_COMPARISON") {
    return {
      format: selected,
      minWords: boundedInteger(
        process.env.AI_DEEP_EXPLAINER_MIN_WORDS,
        2_200,
        1_000,
        4_000,
      ),
      targetWords: boundedInteger(
        process.env.AI_DEEP_EXPLAINER_TARGET_WORDS,
        3_000,
        1_200,
        4_500,
      ),
      maxWords: boundedInteger(
        process.env.AI_DEEP_EXPLAINER_MAX_WORDS,
        4_000,
        1_500,
        5_000,
      ),
    };
  }
  if (selected === "WHY_TRENDING") {
    return {
      format: selected,
      minWords: 1_000,
      targetWords: 1_400,
      maxWords: 1_800,
    };
  }
  return {
    format: selected,
    minWords: boundedInteger(
      process.env.AI_STANDARD_NEWS_MIN_WORDS,
      1_200,
      500,
      2_000,
    ),
    targetWords: boundedInteger(
      process.env.AI_STANDARD_NEWS_TARGET_WORDS,
      1_500,
      650,
      2_500,
    ),
    maxWords: boundedInteger(
      process.env.AI_STANDARD_NEWS_MAX_WORDS,
      2_000,
      800,
      3_000,
    ),
  };
}

async function upsertDiscoveredSources({
  db,
  actorId,
  generated,
  registry,
}: {
  db: D1Database;
  actorId: string;
  generated: GeneratedSource[];
  registry: SourceRegistryRow[];
}): Promise<Array<{ id: string; domain: string }>> {
  const known = new Map(registry.map((source) => [source.domain, source.id]));
  const result: Array<{ id: string; domain: string }> = [];
  const statements: D1PreparedStatement[] = [];
  const now = Date.now();

  for (const source of generated) {
    const domain = normalizeDomain(source.domain);
    const existingId = known.get(domain);
    if (existingId) {
      result.push({ id: existingId, domain });
      continue;
    }
    const id = `source_${crypto.randomUUID().replaceAll("-", "")}`;
    known.set(domain, id);
    result.push({ id, domain });
    const isPrimary = source.sourceKind === "PRIMARY" ? 1 : 0;
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO sources (
            id, name, domain, publisher, source_type, country, ownership,
            credibility_tier, is_primary, citation_requirements,
            licensing_status, reliability_notes, last_reviewed_at,
            created_at, updated_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, 'US', NULL, ?6, ?7, ?8,
            'review_required', ?9, NULL, ?10, ?10)`,
        )
        .bind(
          id,
          source.name,
          domain,
          source.publisher,
          source.sourceType,
          source.sourceKind === "PRIMARY" ? 3 : 4,
          isPrimary,
          "Link and attribute the exact page. Do not copy protected text or media.",
          `AI-discovered source from ${source.url}. Human source review is required before long-term trust promotion.`,
          now,
        ),
      db
        .prepare(
          `INSERT INTO audit_logs (
            id, actor_id, action, target_type, target_id, decision,
            reason, metadata_json, occurred_at
          ) VALUES (?1, ?2, 'SOURCE_DISCOVERED_BY_AI', 'SOURCE', ?3,
            'ALLOWED', ?4, ?5, ?6)`,
        )
        .bind(
          crypto.randomUUID(),
          actorId,
          id,
          "AI-discovered source stored as review_required and link_only evidence.",
          JSON.stringify({ domain, url: source.url, sourceKind: source.sourceKind }),
          now,
        ),
    );
  }

  if (statements.length > 0) await db.batch(statements);
  return result;
}

function articleBodyText(
  sections: Array<{ heading: string; paragraphs: string[] }>,
): string {
  return sections
    .map(
      (section) =>
        `${section.heading}\n\n${section.paragraphs.join("\n\n")}`,
    )
    .join("\n\n");
}

function countWords(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//u, "")
    .replace(/^www\./u, "")
    .replace(/\/.*$/u, "");
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}
