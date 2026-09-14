import { apiErrorResponse } from "@/lib/security/api";
import { issueAuthCsrf } from "@/lib/auth/standard-csrf";
import { resolveStandardAuthConfiguration } from "@/lib/auth/standard-config";

export const runtime = "edge";

export async function GET(request: Request): Promise<Response> {
  try {
    const configuration = resolveStandardAuthConfiguration(request.url);
    const csrf = await issueAuthCsrf({
      secret: configuration.csrfSecret,
      secure: configuration.secureCookies,
    });
    return Response.json(
      { csrfToken: csrf.token },
      {
        headers: {
          "cache-control": "private, no-store",
          "set-cookie": csrf.cookie,
          "x-content-type-options": "nosniff",
        },
      },
    );
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Standard authentication is unavailable.",
    });
  }
}
