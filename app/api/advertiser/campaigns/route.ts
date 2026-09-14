import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  createAdvertiserCampaign,
  listAdvertiserCampaigns,
} from "@/lib/auth/advertiser-tenant";
import {
  advertiserAuthenticationRequired,
  advertiserMutationError,
  advertiserPortalAvailable,
  advertiserPortalUnavailable,
  advertiserServiceError,
  createAdvertiserApiDependencies,
  protectAdvertiserMutation,
} from "@/lib/auth/advertiser-api";
import {
  readJsonBodyWithLimit,
  RequestBodyTooLargeError,
} from "@/lib/newsletter/body";
import {
  apiErrorResponse,
  validateIdempotencyKey,
} from "@/lib/security/api";

export const runtime = "edge";

const MAXIMUM_BODY_BYTES = 8_192;
const campaignInput = z
  .object({
    advertiserOrganizationId: z
      .string()
      .trim()
      .min(8)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/),
    name: z.string().trim().min(2).max(160),
    objective: z.enum([
      "BRAND_AWARENESS",
      "TRAFFIC",
      "LEAD_GENERATION",
      "CONVERSIONS",
      "SPONSORED_CONTENT",
      "NEWSLETTER_SPONSORSHIP",
    ]),
    startsAt: z.string().datetime({ offset: true }).optional(),
    endsAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict()
  .refine(
    (value) =>
      !value.startsAt ||
      !value.endsAt ||
      new Date(value.endsAt).getTime() >= new Date(value.startsAt).getTime(),
    {
      message: "Campaign end time must not precede its start time.",
      path: ["endsAt"],
    },
  );

export async function GET(request: Request): Promise<Response> {
  if (!advertiserPortalAvailable()) return advertiserPortalUnavailable();
  const user = await getChatGPTUser();
  if (!user) return advertiserAuthenticationRequired();

  const parameters = new URL(request.url).searchParams;
  if (
    Array.from(parameters.keys()).some(
      (key) => key !== "advertiserOrganizationId",
    ) ||
    parameters.getAll("advertiserOrganizationId").length !== 1
  ) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Select one advertiser organization.",
    });
  }
  const advertiserOrganizationId =
    parameters.get("advertiserOrganizationId") ?? "";
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(advertiserOrganizationId)) {
    return advertiserServiceError({ ok: false, reason: "not_found" });
  }

  let dependencies: Awaited<
    ReturnType<typeof createAdvertiserApiDependencies>
  >;
  try {
    dependencies = await createAdvertiserApiDependencies();
  } catch {
    return advertiserServiceError({
      ok: false,
      reason: "storage_unavailable",
    });
  }
  const result = await listAdvertiserCampaigns(
    user,
    advertiserOrganizationId,
    dependencies,
  );
  if (!result.ok) return advertiserServiceError(result);
  return Response.json(
    { campaigns: result.value },
    { headers: { "cache-control": "private, no-store" } },
  );
}

export async function POST(request: Request): Promise<Response> {
  if (!advertiserPortalAvailable()) return advertiserPortalUnavailable();
  const user = await getChatGPTUser();
  if (!user) return advertiserAuthenticationRequired();

  const protection = await protectAdvertiserMutation(request, user);
  if (!protection.allowed) return advertiserMutationError(protection);

  const idempotency = validateIdempotencyKey(
    request.headers.get("idempotency-key"),
  );
  if (!idempotency.valid) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message:
        "Provide an idempotency-key containing 16 to 128 safe characters.",
    });
  }

  let raw: unknown;
  try {
    raw = await readJsonBodyWithLimit(request, MAXIMUM_BODY_BYTES);
  } catch (error) {
    return apiErrorResponse(
      error instanceof RequestBodyTooLargeError
        ? "PAYLOAD_TOO_LARGE"
        : "BAD_REQUEST",
      {
        status: error instanceof RequestBodyTooLargeError ? 413 : 400,
        message:
          error instanceof RequestBodyTooLargeError
            ? "The campaign request was larger than expected."
            : "Send a valid campaign request.",
      },
    );
  }
  const parsed = campaignInput.safeParse(raw);
  if (!parsed.success) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Review the campaign request fields.",
    });
  }

  let dependencies: Awaited<
    ReturnType<typeof createAdvertiserApiDependencies>
  >;
  try {
    dependencies = await createAdvertiserApiDependencies();
  } catch {
    return advertiserServiceError({
      ok: false,
      reason: "storage_unavailable",
    });
  }
  const result = await createAdvertiserCampaign(
    user,
    {
      advertiserOrganizationId: parsed.data.advertiserOrganizationId,
      name: parsed.data.name,
      objective: parsed.data.objective,
      startsAt: parsed.data.startsAt
        ? new Date(parsed.data.startsAt)
        : null,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
    },
    idempotency.value,
    dependencies,
  );
  if (!result.ok) return advertiserServiceError(result);
  return Response.json(
    { campaign: result.value },
    {
      status: result.replayed ? 200 : 201,
      headers: {
        "cache-control": "private, no-store",
        ...(result.replayed ? { "idempotency-replayed": "true" } : {}),
      },
    },
  );
}
