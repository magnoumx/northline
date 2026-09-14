import { z } from "zod";
import { getDb } from "@/db";
import { createAiGateway, createD1AiWorkflowLedger, EditorialAiGateway } from "@/lib/ai";
import { prepareAiReviewPackage } from "@/lib/editorial/ai-workflow";
import { authorizeEditorialRequest, protectEditorialMutation } from "@/lib/newsroom/editorial-api-security";
import { readJsonBodyWithLimit, RequestBodyTooLargeError } from "@/lib/newsletter/body";
import { apiErrorResponse } from "@/lib/security/api";

export const runtime = "edge";
const MAX_BODY = 250_000;
const inputSchema = z.object({
  workflowId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u),
  storyId: z.string().max(160).optional(),
  evidence: z.array(z.object({
    id: z.string().min(1).max(160),
    sourceId: z.string().min(1).max(160),
    sourceName: z.string().min(1).max(300),
    sourceType: z.enum(["PRIMARY", "INDEPENDENT", "CONTEXT"]),
    summary: z.string().min(20).max(12_000),
    excerptHash: z.string().min(16).max(160),
    observedAt: z.string().datetime(),
  })).min(2).max(30),
}).strict();

export async function POST(request: Request): Promise<Response> {
  const access = await authorizeEditorialRequest(["article.create", "article.edit.any"]);
  if (!access.allowed) return access.response;
  const protection = await protectEditorialMutation(request, access.user);
  if (!protection.allowed) return protection.response;
  let body: unknown;
  try {
    body = await readJsonBodyWithLimit(request, MAX_BODY);
  } catch (error) {
    return apiErrorResponse(error instanceof RequestBodyTooLargeError ? "PAYLOAD_TOO_LARGE" : "BAD_REQUEST", {
      status: error instanceof RequestBodyTooLargeError ? 413 : 400,
      message: "Send a bounded AI review request.",
    });
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return apiErrorResponse("BAD_REQUEST", { status: 400, message: "Review the workflow and evidence packet." });
  if (process.env.AI_ENABLED !== "true" || process.env.AI_GLOBAL_KILL !== "false") {
    return apiErrorResponse("UNAVAILABLE", { status: 503, message: "The AI newsroom is disabled by policy." });
  }
  try {
    const environment = process.env as Record<string, string | undefined>;
    const gateway = new EditorialAiGateway(createAiGateway({ environment }), environment);
    const result = await prepareAiReviewPackage({
      workflowId: parsed.data.workflowId,
      sourcePacket: parsed.data.evidence,
      operations: gateway,
      ledger: createD1AiWorkflowLedger({ database: await getDb(), storyId: parsed.data.storyId }),
      budget: {
        maxInputTokens: positiveInteger(process.env.AI_MAX_CONTEXT_TOKENS, 24_000),
        maxOutputTokens: positiveInteger(process.env.AI_MAX_OUTPUT_TOKENS, 4_000),
        maxCostUsd: positiveNumber(process.env.AI_PER_STORY_BUDGET_USD, 1),
      },
    });
    return Response.json({ reviewPackage: result }, { status: 201, headers: { "cache-control": "private, no-store" } });
  } catch {
    return apiErrorResponse("UNAVAILABLE", { status: 503, message: "The AI review package could not be completed." });
  }
}
function positiveInteger(value: string | undefined, fallback: number): number { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback; }
function positiveNumber(value: string | undefined, fallback: number): number { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback; }
