import {
  approveArticleForPublication,
  correctionInputSchema,
  publishApprovedArticle,
  withdrawArticle,
  publishArticleCorrection,
  publishArticleInputSchema,
  readEditorialArticle,
  saveArticleDraftVersion,
  saveArticleVersionInputSchema,
  submitArticleForHumanReview,
} from "@/lib/editorial";
import type { Permission } from "@/lib/auth/permissions";
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
const SAFE_ID = /^[A-Za-z0-9:_-]{8,128}$/u;

type Context = { params: Promise<{ articleId: string }> };

export async function GET(
  _request: Request,
  context: Context,
): Promise<Response> {
  const access = await authorizeEditorialRequest([
    "article.edit.own",
    "article.edit.any",
    "audit.view",
  ]);
  if (!access.allowed) return access.response;
  const { articleId } = await context.params;
  if (!SAFE_ID.test(articleId)) return notFound();
  // An inaccessible article answers 404 rather than 403 so the endpoint does
  // not confirm that another desk's draft exists.
  const ownerScope =
    access.permissions.includes("*" as never) ||
    access.permissions.includes("article.edit.any") ||
    access.permissions.includes("audit.view")
      ? undefined
      : access.user.userId;
  try {
    const article = await readEditorialArticle(articleId, ownerScope);
    return article
      ? Response.json(
          { article },
          { headers: { "cache-control": "private, no-store" } },
        )
      : notFound();
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Editorial storage is temporarily unavailable.",
    });
  }
}

export async function PATCH(
  request: Request,
  context: Context,
): Promise<Response> {
  const { articleId } = await context.params;
  if (!SAFE_ID.test(articleId)) return notFound();
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
        message: "Send a valid bounded editorial action.",
      },
    );
  }
  const action =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).action
      : null;
  if (
    action !== "save" &&
    action !== "submit" &&
    action !== "approve" &&
    action !== "publish" &&
    action !== "correct" &&
    action !== "archive" &&
    action !== "retract"
  ) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Select a supported editorial action.",
    });
  }
  const access = await authorizeEditorialRequest(permissionsForAction(action));
  if (!access.allowed) return access.response;
  const protection = await protectEditorialMutation(request, access.user);
  if (!protection.allowed) return protection.response;

  // A principal restricted to its own work may only mutate an article it
  // authored or is assigned to. An article outside that scope answers 404.
  const restrictedToOwn =
    !access.permissions.includes("*" as never) &&
    !access.permissions.includes("article.edit.any");
  if (restrictedToOwn) {
    const owned = await readEditorialArticle(articleId, access.user.userId);
    if (!owned) return notFound();
  }

  const input = { ...(body as Record<string, unknown>) };
  delete input.action;
  try {
    const result =
      action === "save"
        ? await saveArticleDraftVersion(
            articleId,
            saveArticleVersionInputSchema.parse(input),
            { userId: access.user.userId, type: "EDITOR" },
            idempotency.value,
          )
        : action === "submit"
          ? await submitArticleForHumanReview(
              articleId,
              publishArticleInputSchema.parse(input),
              { userId: access.user.userId, type: "EDITOR" },
              idempotency.value,
            )
        : action === "approve"
          ? await approveArticleForPublication(
              articleId,
              publishArticleInputSchema.parse(input),
              { userId: access.user.userId, type: "REVIEWER" },
              idempotency.value,
            )
          : action === "publish"
            ? await publishApprovedArticle(
                articleId,
                publishArticleInputSchema.parse(input),
                { userId: access.user.userId, type: "PUBLISHER" },
                idempotency.value,
              )
            : action === "correct"
              ? await publishArticleCorrection(
                  articleId,
                  correctionInputSchema.parse(input),
                  { userId: access.user.userId, type: "PUBLISHER" },
                  idempotency.value,
                )
              : await withdrawArticle(
                  articleId,
                  {
                    state: action === "retract" ? "RETRACTED" : "ARCHIVED",
                    reason:
                      typeof input.reason === "string" && input.reason.trim()
                        ? input.reason.trim()
                        : "Withdrawn from publication by an editor.",
                  },
                  { userId: access.user.userId, type: "PUBLISHER" },
                  idempotency.value,
                );
    return Response.json(
      { article: result },
      {
        headers: {
          "cache-control": "private, no-store",
          ...(result.replayed ? { "idempotency-replayed": "true" } : {}),
        },
      },
    );
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) {
      return apiErrorResponse("BAD_REQUEST", {
        status: 400,
        message: "Review the editorial action fields.",
      });
    }
    return editorialWriteErrorResponse(error);
  }
}

/**
 * Saving and submitting are the Writer workflow. Requiring article.edit.any
 * made that role unable to touch its own assignments, so either grant is
 * accepted here and ownership is verified separately for a principal that only
 * holds article.edit.own.
 */
function permissionsForAction(
  action:
    | "save"
    | "submit"
    | "approve"
    | "publish"
    | "correct"
    | "archive"
    | "retract",
): readonly Permission[] {
  if (action === "save" || action === "submit") {
    return ["article.edit.own", "article.edit.any"];
  }
  if (action === "approve") return ["article.approve"];
  if (action === "publish") return ["article.publish"];
  // Taking a story down is a publishing decision, not an editing one.
  if (action === "archive" || action === "retract") return ["article.publish"];
  return ["article.correct"];
}

function notFound(): Response {
  return apiErrorResponse("NOT_FOUND", {
    status: 404,
    message: "Article not found.",
  });
}
