import {
  authorizeEditorialRequest,
  issueEditorialCsrf,
} from "@/lib/newsroom/editorial-api-security";

export const runtime = "edge";

export async function GET(): Promise<Response> {
  const access = await authorizeEditorialRequest(["workspace.access"]);
  if (!access.allowed) return access.response;
  try {
    return Response.json(
      { csrfToken: await issueEditorialCsrf(access.user) },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      { error: { code: "UNAVAILABLE", message: "CSRF is unavailable." } },
      { status: 503, headers: { "cache-control": "private, no-store" } },
    );
  }
}
