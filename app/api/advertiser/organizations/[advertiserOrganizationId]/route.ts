import { getChatGPTUser } from "@/app/chatgpt-auth";
import { readAdvertiserOrganization } from "@/lib/auth/advertiser-tenant";
import {
  advertiserAuthenticationRequired,
  advertiserPortalAvailable,
  advertiserPortalUnavailable,
  advertiserServiceError,
  createAdvertiserApiDependencies,
} from "@/lib/auth/advertiser-api";

export const runtime = "edge";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ advertiserOrganizationId: string }>;
  },
): Promise<Response> {
  if (!advertiserPortalAvailable()) return advertiserPortalUnavailable();
  const user = await getChatGPTUser();
  if (!user) return advertiserAuthenticationRequired();

  const { advertiserOrganizationId } = await params;
  if (!isOpaqueId(advertiserOrganizationId)) {
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
  const result = await readAdvertiserOrganization(
    user,
    advertiserOrganizationId,
    dependencies,
  );
  if (!result.ok) return advertiserServiceError(result);
  return Response.json(
    { organization: result.value },
    { headers: { "cache-control": "private, no-store" } },
  );
}

function isOpaqueId(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,128}$/.test(value);
}
