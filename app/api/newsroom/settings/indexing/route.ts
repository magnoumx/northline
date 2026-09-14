import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { authorizeStaffIdentity } from "@/lib/auth/rbac";
import { resolveSiteOrigin } from "@/lib/newsletter/origin";
import { readJsonBodyWithLimit } from "@/lib/newsletter/body";
import { apiErrorResponse } from "@/lib/security/api";
import { createCsrfToken, verifyCsrfToken } from "@/lib/security/csrf";
import { validateMutationRequest } from "@/lib/security/origin";
import {
  INDEXING_LAUNCH_GATES,
  IndexingControlError,
  readLatestIndexingDecision,
  recordIndexingDecision,
} from "@/lib/site/indexing-control";

export const runtime = "edge";
const MAXIMUM_BODY_BYTES = 4_096;
const LOCAL_CSRF_SECRET =
  "northline-local-indexing-control-secret-not-for-production";

const checklistSchema = z.object(
  Object.fromEntries(
    INDEXING_LAUNCH_GATES.map((gate) => [gate, z.boolean()]),
  ) as Record<(typeof INDEXING_LAUNCH_GATES)[number], z.ZodBoolean>,
);
const requestSchema = z
  .object({
    enabled: z.boolean(),
    reason: z.string().trim().min(20).max(500),
    checklist: checklistSchema.strict(),
  })
  .strict();

export async function GET(request: Request): Promise<Response> {
  const access = await requireOwner();
  if (!access.ok) return access.response;
  try {
    const csrfToken = await createCsrfToken({
      secret: csrfSecret(),
      subject: csrfSubject(access.ownerId),
    });
    return Response.json(
      {
        indexingDecision: await readLatestIndexingDecision(),
        environmentGate: {
          appEnvironment: process.env.APP_ENV ?? "development",
          demoContentMode: process.env.DEMO_CONTENT_MODE ?? "implicit",
          environmentFlag: process.env.ENABLE_SEARCH_INDEXING ?? "false",
          siteOrigin: safeVisibleOrigin(request),
        },
        launchGates: INDEXING_LAUNCH_GATES,
        csrfToken,
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Indexing control storage or security is unavailable.",
    });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const access = await requireOwner();
  if (!access.ok) return access.response;
  const protection = await protectMutationRequest(request, access.ownerId);
  if (!protection.ok) return protection.response;

  let parsedBody: unknown;
  try {
    parsedBody = await readJsonBodyWithLimit(request, MAXIMUM_BODY_BYTES);
  } catch {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Send a valid, bounded JSON launch decision.",
    });
  }
  const parsed = requestSchema.safeParse(parsedBody);
  if (!parsed.success) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Complete every indexing gate and provide a decision reason.",
    });
  }

  try {
    const decision = await recordIndexingDecision({
      ...parsed.data,
      ownerId: access.ownerId,
    });
    return Response.json(
      { indexingDecision: decision },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof IndexingControlError) {
      return apiErrorResponse("CONFLICT", {
        status: 409,
        message: error.message,
      });
    }
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "The indexing decision could not be stored.",
    });
  }
}

async function requireOwner(): Promise<
  | { ok: true; ownerId: string }
  | { ok: false; response: Response }
> {
  const user = await getChatGPTUser();
  if (!user) {
    return {
      ok: false,
      response: apiErrorResponse("UNAUTHORIZED", {
        status: 401,
        message: "Authentication is required.",
      }),
    };
  }
  const authorization = await authorizeStaffIdentity(user, ["settings.manage"]);
  if (
    !authorization.allowed ||
    !authorization.roles.includes("Owner")
  ) {
    return {
      ok: false,
      response: apiErrorResponse("FORBIDDEN", {
        status: 403,
        message: "Only an authenticated owner can change search indexing.",
      }),
    };
  }
  return { ok: true, ownerId: authorization.principal.userId };
}

async function protectMutationRequest(
  request: Request,
  ownerId: string,
): Promise<
  { ok: true } | { ok: false; response: Response }
> {
  let origin: string;
  let secret: string;
  try {
    origin = resolveSiteOrigin({
      requestUrl: request.url,
      configuredOrigin: process.env.NEXT_PUBLIC_SITE_URL,
      production: process.env.APP_ENV === "production",
    });
    secret = csrfSecret();
  } catch {
    return {
      ok: false,
      response: apiErrorResponse("UNAVAILABLE", {
        status: 503,
        message: "Indexing control security is not configured.",
      }),
    };
  }
  const requestValidation = validateMutationRequest(request, {
    allowedOrigins: [origin],
    allowedMediaTypes: ["application/json"],
    requireOrigin: true,
  });
  if (!requestValidation.allowed) {
    return {
      ok: false,
      response: apiErrorResponse(
        requestValidation.status === 415
          ? "UNSUPPORTED_MEDIA_TYPE"
          : "FORBIDDEN",
        {
          status: requestValidation.status,
          message: "The indexing request could not be verified.",
        },
      ),
    };
  }
  const verification = await verifyCsrfToken(
    request.headers.get("x-csrf-token") ?? "",
    { secret, subject: csrfSubject(ownerId) },
  );
  return verification.valid
    ? { ok: true }
    : {
        ok: false,
        response: apiErrorResponse("FORBIDDEN", {
          status: 403,
          message: "The indexing request could not be verified.",
        }),
      };
}

function csrfSubject(ownerId: string): string {
  return `indexing-control:${ownerId}`;
}

function csrfSecret(): string {
  const configured = process.env.CSRF_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (process.env.APP_ENV === "production") {
    throw new Error("CSRF_SECRET is required in production.");
  }
  return LOCAL_CSRF_SECRET;
}

function safeVisibleOrigin(request: Request): string {
  try {
    return resolveSiteOrigin({
      requestUrl: request.url,
      configuredOrigin: process.env.NEXT_PUBLIC_SITE_URL,
      production: process.env.APP_ENV === "production",
    });
  } catch {
    return "unavailable";
  }
}
