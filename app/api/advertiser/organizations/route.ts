import { z } from "zod";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  createAdvertiserOrganization,
  listAdvertiserOrganizations,
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
import { validateExternalHttpUrl } from "@/lib/security/url";

export const runtime = "edge";

const MAXIMUM_BODY_BYTES = 8_192;
const organizationInput = z
  .object({
    legalName: z.string().trim().min(2).max(180),
    displayName: z.string().trim().min(2).max(120),
    websiteUrl: z.string().trim().min(1).max(2_048),
    organizationName: z.string().trim().min(2).max(160),
    organizationSlug: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    industry: z.string().trim().min(2).max(80).optional(),
    billingEmail: z.string().trim().email().max(254).optional(),
  })
  .strict();

export async function GET(): Promise<Response> {
  if (!advertiserPortalAvailable()) return advertiserPortalUnavailable();
  const user = await getChatGPTUser();
  if (!user) return advertiserAuthenticationRequired();

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
  const result = await listAdvertiserOrganizations(user, dependencies);
  if (!result.ok) return advertiserServiceError(result);
  return Response.json(
    { organizations: result.value },
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
            ? "The organization request was larger than expected."
            : "Send a valid organization request.",
      },
    );
  }
  const parsed = organizationInput.safeParse(raw);
  if (!parsed.success) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Review the advertiser organization fields.",
    });
  }
  const website = validateExternalHttpUrl(parsed.data.websiteUrl);
  if (!website.valid) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Provide a valid HTTPS advertiser website.",
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
  const result = await createAdvertiserOrganization(
    user,
    {
      legalName: parsed.data.legalName,
      displayName: parsed.data.displayName,
      websiteUrl: website.url.toString(),
      organizationName: parsed.data.organizationName,
      organizationSlug: parsed.data.organizationSlug,
      industry: parsed.data.industry ?? null,
      billingEmail: parsed.data.billingEmail?.toLowerCase() ?? null,
    },
    idempotency.value,
    dependencies,
  );
  if (!result.ok) return advertiserServiceError(result);
  return Response.json(
    { organization: result.value },
    {
      status: result.replayed ? 200 : 201,
      headers: {
        "cache-control": "private, no-store",
        ...(result.replayed ? { "idempotency-replayed": "true" } : {}),
      },
    },
  );
}
