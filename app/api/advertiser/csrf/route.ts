import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  advertiserAuthenticationRequired,
  advertiserPortalAvailable,
  advertiserPortalUnavailable,
  createAdvertiserCsrfToken,
} from "@/lib/auth/advertiser-api";
import { apiErrorResponse } from "@/lib/security/api";

export const runtime = "edge";

export async function GET(request: Request): Promise<Response> {
  if (!advertiserPortalAvailable()) return advertiserPortalUnavailable();
  const user = await getChatGPTUser();
  if (!user) return advertiserAuthenticationRequired();
  try {
    return Response.json(
      {
        csrfToken: await createAdvertiserCsrfToken(user, request),
      },
      {
        headers: {
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        },
      },
    );
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Advertiser request security is temporarily unavailable.",
    });
  }
}
