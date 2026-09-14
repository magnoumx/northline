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

export async function POST(request: Request): Promise<Response> {
  let configuration;
  try {
    configuration = resolveStandardAuthConfiguration(request.url);
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Standard authentication is unavailable.",
    });
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
            ? "Send the sign-out request as JSON."
            : "The sign-out request could not be verified.",
      },
    );
  }

  try {
    const db = await getDb();
    const repository = createD1StandardAuthRepository(db);
    const session = await authenticateStandardRequest(request, {
      repository,
      configuration,
    });
    if (session) {
      const now = new Date();
      const clientAddress = await resolveAttestedClientAddress(request.headers);
      const context = await hashAuthRequestContext(
        {
          clientAddress,
          userAgent: request.headers.get("user-agent"),
        },
        configuration.rateLimitSecret,
      );
      await repository.revokeSession({
        sessionId: session.claims.sessionId,
        userId: session.claims.userId,
        reason: "USER_SIGN_OUT",
        now,
      });
      await repository.recordAudit({
        event: "SESSION_REVOKED",
        decision: "ALLOW",
        reason: "USER_SIGN_OUT",
        userId: session.claims.userId,
        sessionIdHash: await hmacSha256Base64Url(
          configuration.rateLimitSecret,
          `session:${session.claims.sessionId}`,
        ),
        clientIpHash: context.clientIpHash,
        userAgentHash: context.userAgentHash,
        now,
      });
    }
    return new Response(null, {
      status: 204,
      headers: {
        "cache-control": "no-store",
        "set-cookie": clearSessionCookie({
          secure: configuration.secureCookies,
        }),
      },
    });
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Sign-out storage is temporarily unavailable.",
      headers: {
        "set-cookie": clearSessionCookie({
          secure: configuration.secureCookies,
        }),
      },
    });
  }
}
