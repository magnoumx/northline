import { getDb } from "@/db";
import {
  resolveStandardAuthConfiguration,
} from "@/lib/auth/standard-config";
import {
  createD1StandardAuthRepository,
} from "@/lib/auth/standard-repository";
import {
  authenticateStandardRequest,
} from "@/lib/auth/standard-service";
import { apiErrorResponse } from "@/lib/security/api";

export const runtime = "edge";

export async function GET(request: Request): Promise<Response> {
  try {
    const configuration = resolveStandardAuthConfiguration(request.url);
    const repository = createD1StandardAuthRepository(await getDb());
    const current = await authenticateStandardRequest(request, {
      repository,
      configuration,
    });
    if (!current) return authenticationRequired();
    const sessions = await repository.listSessions(current.claims.userId);
    return Response.json(
      {
        sessions: sessions.map((session) => ({
          id: session.id,
          current: session.id === current.claims.sessionId,
          createdAt: session.createdAt.toISOString(),
          lastSeenAt: session.lastSeenAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
          revokedAt: session.revokedAt?.toISOString() ?? null,
          revocationReason: session.revocationReason,
        })),
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
      message: "Session storage is temporarily unavailable.",
    });
  }
}

function authenticationRequired(): Response {
  return apiErrorResponse("UNAUTHORIZED", {
    status: 401,
    message: "Authentication is required.",
    headers: { "www-authenticate": "Session" },
  });
}
