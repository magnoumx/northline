import { getDb } from "@/db";
import {
  resolveStandardAuthConfiguration,
} from "@/lib/auth/standard-config";
import { verifyAuthMutation } from "@/lib/auth/standard-csrf";
import {
  createD1StandardAuthRepository,
} from "@/lib/auth/standard-repository";
import {
  authenticateStandardRequest,
  hashAuthRequestContext,
} from "@/lib/auth/standard-service";
import { clearSessionCookie } from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/security/api";
import {
  hmacSha256Base64Url,
} from "@/lib/security/crypto";
import { resolveAttestedClientAddress } from "@/lib/security/request-trust";

export const runtime = "edge";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  let configuration;
  try {
    configuration = resolveStandardAuthConfiguration(request.url);
  } catch {
    return unavailable();
  }
  const protection = await verifyAuthMutation(request, {
    origin: configuration.origin,
    secret: configuration.csrfSecret,
  });
  if (!protection.allowed) {
    return apiErrorResponse(
      protection.status === 415 ? "UNSUPPORTED_MEDIA_TYPE" : "FORBIDDEN",
      {
        status: protection.status,
        message:
          protection.reason === "media_type"
            ? "Send the session request as JSON."
            : "The session request could not be verified.",
      },
    );
  }

  try {
    const repository = createD1StandardAuthRepository(await getDb());
    const current = await authenticateStandardRequest(request, {
      repository,
      configuration,
    });
    if (!current) {
      return apiErrorResponse("UNAUTHORIZED", {
        status: 401,
        message: "Authentication is required.",
        headers: { "www-authenticate": "Session" },
      });
    }
    const { sessionId } = await params;
    if (!/^[A-Za-z0-9:_-]{8,128}$/.test(sessionId)) {
      return apiErrorResponse("NOT_FOUND", {
        status: 404,
        message: "The requested session was not found.",
      });
    }
    const now = new Date();
    const revoked = await repository.revokeSession({
      sessionId,
      userId: current.claims.userId,
      reason: "USER_SESSION_MANAGEMENT",
      now,
    });
    if (revoked) {
      const context = await hashAuthRequestContext(
        {
          clientAddress: await resolveAttestedClientAddress(request.headers),
          userAgent: request.headers.get("user-agent"),
        },
        configuration.rateLimitSecret,
      );
      await repository.recordAudit({
        event: "SESSION_REVOKED",
        decision: "ALLOW",
        reason: "USER_SESSION_MANAGEMENT",
        userId: current.claims.userId,
        sessionIdHash: await hmacSha256Base64Url(
          configuration.rateLimitSecret,
          `session:${sessionId}`,
        ),
        clientIpHash: context.clientIpHash,
        userAgentHash: context.userAgentHash,
        now,
      });
    }
    const headers = new Headers({ "cache-control": "no-store" });
    if (sessionId === current.claims.sessionId) {
      headers.set(
        "set-cookie",
        clearSessionCookie({ secure: configuration.secureCookies }),
      );
    }
    return new Response(null, { status: 204, headers });
  } catch {
    return unavailable();
  }
}

function unavailable(): Response {
  return apiErrorResponse("UNAVAILABLE", {
    status: 503,
    message: "Session storage is temporarily unavailable.",
  });
}
