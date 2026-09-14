import { z } from "zod";
import { createAiGateway, EditorialAiGateway } from "@/lib/ai";
import {
  authorizeEditorialRequest,
  protectEditorialMutation,
} from "@/lib/newsroom/editorial-api-security";
import { readJsonBodyWithLimit } from "@/lib/newsletter/body";
import { apiErrorResponse } from "@/lib/security/api";

export const runtime = "edge";

const inputSchema = z
  .object({
    section: z.enum(["headline", "summary", "body"]),
    instruction: z.string().trim().min(3).max(1_000),
    currentContent: z.string().trim().min(10).max(80_000),
    headline: z.string().trim().min(5).max(220),
    centralClaim: z.string().trim().min(5).max(2_000),
    sourceSummaries: z.array(z.string().trim().min(10).max(4_000)).min(1).max(10),
    targetWords: z.number().int().min(100).max(3_500).optional(),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  const access = await authorizeEditorialRequest([
    "article.create",
    "article.edit.any",
  ]);
  if (!access.allowed) return access.response;
  const protection = await protectEditorialMutation(request, access.user);
  if (!protection.allowed) return protection.response;

  let raw: unknown;
  try {
    raw = await readJsonBodyWithLimit(request, 120_000);
  } catch {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Send a bounded section regeneration request.",
    });
  }
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Review the selected section, locked facts, and instruction.",
    });
  }
  if (process.env.AI_ENABLED !== "true" || process.env.AI_GLOBAL_KILL !== "false") {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "AI editing is disabled by policy.",
    });
  }

  try {
    const environment = process.env as Record<string, string | undefined>;
    const gateway = new EditorialAiGateway(
      createAiGateway({ environment }),
      environment,
    );
    const result = await gateway.regenerateSection({
      taskId: `section_${crypto.randomUUID().replaceAll("-", "")}`,
      content: {
        requestedSection: parsed.data.section,
        operatorInstruction: parsed.data.instruction,
        currentContent: parsed.data.currentContent,
        lockedHeadline: parsed.data.headline,
        lockedCentralClaim: parsed.data.centralClaim,
        lockedSourceSummaries: parsed.data.sourceSummaries,
        targetWords: parsed.data.targetWords ?? null,
      },
      budget: {
        maxInputTokens: positiveInteger(process.env.AI_MAX_CONTEXT_TOKENS, 24_000),
        maxOutputTokens: Math.min(
          positiveInteger(process.env.AI_MAX_OUTPUT_TOKENS, 8_000),
          8_000,
        ),
        maxCostUsd: positiveNumber(process.env.AI_PER_TASK_BUDGET_USD, 0.5),
      },
    });
    return Response.json(
      {
        regenerated: result.data,
        metadata: {
          provider: result.metadata.provider,
          model: result.metadata.model,
          costUsd: result.metadata.costUsd,
          durationMs:
            Date.parse(result.metadata.endedAt) -
            Date.parse(result.metadata.startedAt),
        },
      },
      { status: 201, headers: { "cache-control": "private, no-store" } },
    );
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "The selected section could not be regenerated.",
    });
  }
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
