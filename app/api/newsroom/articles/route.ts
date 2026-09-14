import {
  createArticleDraft,
  createArticleInputSchema,
  listEditorialArticles,
} from "@/lib/editorial";
import {
  authorizeEditorialRequest,
  protectEditorialMutation,
} from "@/lib/newsroom/editorial-api-security";
import { editorialWriteErrorResponse } from "@/lib/newsroom/editorial-api-errors";
import {
  readJsonBodyWithLimit,
  RequestBodyTooLargeError,
} from "@/lib/newsletter/body";
import { apiErrorResponse, validateIdempotencyKey } from "@/lib/security/api";

export const runtime = "edge";
const MAXIMUM_BODY_BYTES = 600_000;

export async function GET(request: Request): Promise<Response> {
  const access = await authorizeEditorialRequest([
    "article.edit.own",
    "article.edit.any",
    "audit.view",
  ]);
  if (!access.allowed) return access.response;
  const rawLimit = new URL(request.url).searchParams.get("limit");
  const limit = rawLimit ? Number(rawLimit) : 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Article limit must be an integer from 1 through 100.",
    });
  }
  // A principal that only holds article.edit.own must not see other desks'
  // unpublished work, so the scope is decided here and enforced in the query.
  const ownerScope =
    access.permissions.includes("*" as never) ||
    access.permissions.includes("article.edit.any") ||
    access.permissions.includes("audit.view")
      ? undefined
      : access.user.userId;
  try {
    return Response.json(
      { articles: await listEditorialArticles(limit, ownerScope) },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Editorial storage is temporarily unavailable.",
    });
  }
}

export async function POST(request: Request): Promise<Response> {
  const access = await authorizeEditorialRequest(["article.create"]);
  if (!access.allowed) return access.response;
  const protection = await protectEditorialMutation(request, access.user);
  if (!protection.allowed) return protection.response;
  const idempotency = validateIdempotencyKey(
    request.headers.get("idempotency-key"),
  );
  if (!idempotency.valid) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Provide a valid editorial idempotency key.",
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
        message: "Send a valid bounded article document.",
      },
    );
  }
  const parsed = createArticleInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Review the article, evidence, and SEO fields.",
    });
  }
  try {
    const result = await createArticleDraft(
      parsed.data,
      { userId: access.user.userId, type: "EDITOR" },
      idempotency.value,
    );
    return Response.json(
      { article: result },
      {
        status: result.replayed ? 200 : 201,
        headers: {
          "cache-control": "private, no-store",
          ...(result.replayed ? { "idempotency-replayed": "true" } : {}),
        },
      },
    );
  } catch (error) {
    return editorialWriteErrorResponse(error);
  }
}
