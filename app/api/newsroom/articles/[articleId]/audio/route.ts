import { z } from "zod";
import { getD1Binding, getDb } from "@/db";
import {
  ArticleAudioError,
  createArticleAudioService,
  createD1ArticleAudioRepository,
  readArticleAudioConfig,
} from "@/lib/audio";
import { createD1DurableJobRepository } from "@/lib/jobs/d1-repository";
import {
  authorizeEditorialRequest,
  protectEditorialMutation,
} from "@/lib/newsroom/editorial-api-security";
import {
  readJsonBodyWithLimit,
  RequestBodyTooLargeError,
} from "@/lib/newsletter/body";
import { apiErrorResponse, validateIdempotencyKey } from "@/lib/security/api";

export const runtime = "edge";

const MAXIMUM_BODY_BYTES = 4_096;
const SAFE_ID = /^[A-Za-z0-9:_-]{8,160}$/u;
const generationRequest = z
  .object({
    expectedArticleVersionId: z.string().regex(SAFE_ID),
    variant: z.enum(["FULL_ARTICLE", "QUICK_BRIEF"]),
    forceRegeneration: z.boolean().optional().default(false),
  })
  .strict();

type Context = { params: Promise<{ articleId: string }> };

export async function POST(
  request: Request,
  context: Context,
): Promise<Response> {
  const { articleId } = await context.params;
  if (!SAFE_ID.test(articleId)) return notFound();
  const access = await authorizeEditorialRequest(["article.publish"]);
  if (!access.allowed) return access.response;
  const protection = await protectEditorialMutation(request, access.user);
  if (!protection.allowed) return protection.response;
  const idempotency = validateIdempotencyKey(
    request.headers.get("idempotency-key"),
  );
  if (!idempotency.valid) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Provide a valid article-audio idempotency key.",
    });
  }
  let body: unknown;
  try {
    body = await readJsonBodyWithLimit(request, MAXIMUM_BODY_BYTES);
  } catch (error) {
    return apiErrorResponse(
      error instanceof RequestBodyTooLargeError
        ? "PAYLOAD_TOO_LARGE"
        : "BAD_REQUEST",
      {
        status: error instanceof RequestBodyTooLargeError ? 413 : 400,
        message: "Send a valid bounded article-audio request.",
      },
    );
  }
  const parsed = generationRequest.safeParse(body);
  if (!parsed.success) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Review the article version and audio variant.",
    });
  }

  try {
    const config = readArticleAudioConfig(process.env);
    if (!config.generationEnabled) return notFound();
    const database = await getD1Binding();
    const repository = createD1ArticleAudioRepository(database);
    const service = createArticleAudioService({
      config,
      repository,
      queue: createD1DurableJobRepository(await getDb()),
      queueName: process.env.ARTICLE_AUDIO_QUEUE_NAME,
    });
    const result = await service.requestGeneration({
      articleId,
      expectedArticleVersionId: parsed.data.expectedArticleVersionId,
      variant: parsed.data.variant,
      forceRegeneration: parsed.data.forceRegeneration,
      requestedById: access.user.userId,
      idempotencyKey: idempotency.value,
    });
    return Response.json(
      {
        audio: result.audio,
        outcome: result.plan.outcome,
      },
      {
        status:
          result.plan.outcome === "REJECT"
            ? 422
            : result.audio?.state === "READY"
              ? 200
              : 202,
        headers: {
          "cache-control": "private, no-store",
          ...(result.queueReplayed
            ? { "idempotency-replayed": "true" }
            : {}),
        },
      },
    );
  } catch (error) {
    return audioErrorResponse(error);
  }
}

function audioErrorResponse(error: unknown): Response {
  if (error instanceof ArticleAudioError) {
    if (
      error.code === "ARTICLE_NOT_FOUND" ||
      error.code === "ARTICLE_NOT_PUBLISHED"
    ) {
      return notFound();
    }
    if (
      error.code === "ARTICLE_VERSION_CONFLICT" ||
      error.code === "STATE_CONFLICT" ||
      error.code === "BUDGET_EXCEEDED"
    ) {
      return apiErrorResponse("CONFLICT", {
        status: 409,
        message:
          error.code === "BUDGET_EXCEEDED"
            ? "The configured article-audio budget is unavailable."
            : "Article audio changed before the request could be completed.",
      });
    }
    if (error.code === "CONFIGURATION_INVALID") {
      return apiErrorResponse("UNAVAILABLE", {
        status: 503,
        message: "Article audio is not configured.",
      });
    }
  }
  return apiErrorResponse("UNAVAILABLE", {
    status: 503,
    message: "Article audio generation is temporarily unavailable.",
  });
}

function notFound(): Response {
  return apiErrorResponse("NOT_FOUND", {
    status: 404,
    message: "Article audio is not available.",
  });
}
