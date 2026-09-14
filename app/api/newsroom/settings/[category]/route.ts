import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { authorizeStaffIdentity } from "@/lib/auth/rbac";
import { protectEditorialMutation } from "@/lib/newsroom/editorial-api-security";
import { readJsonBodyWithLimit } from "@/lib/newsletter/body";
import { apiErrorResponse } from "@/lib/security/api";
import {
  isSettingsCategory,
  readSettingsCategory,
  rollbackSetting,
  settingRequiresOwner,
  SettingsRegistryError,
  updateSetting,
} from "@/lib/settings/registry";

export const runtime = "edge";
const MAXIMUM_BODY_BYTES = 16_384;

const updateSchema = z
  .object({
    action: z.literal("update"),
    key: z.string().trim().min(3).max(200),
    value: z.unknown(),
    expectedVersion: z.number().int().min(0),
    reason: z.string().trim().min(12).max(500),
  })
  .strict();
const rollbackSchema = z
  .object({
    action: z.literal("rollback"),
    key: z.string().trim().min(3).max(200),
    toVersion: z.number().int().min(1),
    expectedVersion: z.number().int().min(1),
    reason: z.string().trim().min(12).max(450),
  })
  .strict();
const requestSchema = z.discriminatedUnion("action", [updateSchema, rollbackSchema]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ category: string }> },
): Promise<Response> {
  const { category } = await context.params;
  if (!isSettingsCategory(category)) return notFound();
  const access = await requireSettingsAccess();
  if (!access.ok) return access.response;
  try {
    return Response.json(
      {
        category,
        environment: runtimeEnvironment(),
        settings: await readSettingsCategory(category, runtimeEnvironment()),
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Settings storage is unavailable.",
    });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ category: string }> },
): Promise<Response> {
  const { category } = await context.params;
  if (!isSettingsCategory(category)) return notFound();
  const access = await requireSettingsAccess();
  if (!access.ok) return access.response;
  const protection = await protectEditorialMutation(request, access.user);
  if (!protection.allowed) return protection.response;

  let payload: unknown;
  try {
    payload = await readJsonBodyWithLimit(request, MAXIMUM_BODY_BYTES);
  } catch {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Send a valid, bounded settings request.",
    });
  }
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success || !parsed.data.key.startsWith(`${category}.`)) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Send a setting that belongs to this settings category.",
    });
  }
  if (
    (parsed.data.action === "rollback" || settingRequiresOwner(parsed.data.key)) &&
    !access.isOwner
  ) {
    return apiErrorResponse("FORBIDDEN", {
      status: 403,
      message: "Only an authenticated owner can make this settings change.",
    });
  }

  try {
    const result =
      parsed.data.action === "rollback"
        ? await rollbackSetting({
            ...parsed.data,
            environment: runtimeEnvironment(),
            actorId: access.user.userId,
          })
        : await updateSetting({
            ...parsed.data,
            environment: runtimeEnvironment(),
            actorId: access.user.userId,
          });
    return Response.json(
      { setting: result },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof SettingsRegistryError) {
      return apiErrorResponse(
        error.code === "CONFLICT"
          ? "CONFLICT"
          : error.code === "NOT_FOUND"
            ? "NOT_FOUND"
            : error.code === "PROTECTED"
              ? "FORBIDDEN"
              : "BAD_REQUEST",
        {
          status:
            error.code === "CONFLICT"
              ? 409
              : error.code === "NOT_FOUND"
                ? 404
                : error.code === "PROTECTED"
                  ? 403
                  : 400,
          message: error.message,
        },
      );
    }
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "The setting could not be saved.",
    });
  }
}

async function requireSettingsAccess(): Promise<
  | { ok: true; user: NonNullable<Awaited<ReturnType<typeof getChatGPTUser>>>; isOwner: boolean }
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
  if (!authorization.allowed) {
    return {
      ok: false,
      response: apiErrorResponse("FORBIDDEN", {
        status: 403,
        message: "The newsroom role cannot manage settings.",
      }),
    };
  }
  return {
    ok: true,
    user: { ...user, userId: authorization.principal.userId },
    isOwner: authorization.roles.includes("Owner"),
  };
}

function runtimeEnvironment(): string {
  const environment = process.env.APP_ENV?.trim().toLowerCase();
  return environment === "production" || environment === "staging"
    ? environment
    : "development";
}

function notFound(): Response {
  return apiErrorResponse("NOT_FOUND", {
    status: 404,
    message: "Settings category not found.",
  });
}
