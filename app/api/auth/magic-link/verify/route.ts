import { getDb } from "@/db";
import {
  resolveStandardAuthConfiguration,
} from "@/lib/auth/standard-config";
import {
  createD1AuthRateLimitStore,
  enforceMagicLinkVerifyRateLimit,
} from "@/lib/auth/standard-rate-limit";
import {
  createD1StandardAuthRepository,
} from "@/lib/auth/standard-repository";
import {
  hashAuthRequestContext,
  verifyMagicLink,
} from "@/lib/auth/standard-service";
import { serializeSessionCookie } from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/security/api";
import { resolveAttestedClientAddress } from "@/lib/security/request-trust";

export const runtime = "edge";

export async function GET(request: Request): Promise<Response> {
  let configuration;
  try {
    configuration = resolveStandardAuthConfiguration(request.url);
  } catch {
    return unavailableResponse();
  }
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() ?? "";

  try {
    const db = await getDb();
    const repository = createD1StandardAuthRepository(db);
    const clientAddress = await resolveAttestedClientAddress(request.headers);
    const rateLimit = await enforceMagicLinkVerifyRateLimit({
      store: createD1AuthRateLimitStore(db),
      clientAddress,
      secret: configuration.rateLimitSecret,
    });
    if (!rateLimit.allowed) {
      try {
        const hashes = await hashAuthRequestContext(
          {
            clientAddress,
            userAgent: request.headers.get("user-agent"),
          },
          configuration.rateLimitSecret,
        );
        await repository.recordAudit({
          event: "MAGIC_LINK_VERIFY",
          decision: "DENY",
          reason: "RATE_LIMITED",
          clientIpHash: hashes.clientIpHash,
          userAgentHash: hashes.userAgentHash,
          now: new Date(),
        });
      } catch {
        // Rate limiting remains active if audit storage is degraded.
      }
      return apiErrorResponse("RATE_LIMITED", {
        status: 429,
        message: "Too many verification attempts. Try again later.",
        headers: {
          "retry-after": String(rateLimit.retryAfterSeconds),
          "referrer-policy": "no-referrer",
        },
      });
    }

    const result = await verifyMagicLink(token, {
      repository,
      configuration,
      context: {
        clientAddress,
        userAgent: request.headers.get("user-agent"),
      },
    });
    if (!result.ok) {
      if (result.reason === "staff_mfa_required") {
        return apiErrorResponse("FORBIDDEN", {
          status: 403,
          message:
            "Staff sign-in requires a configured and verified second factor.",
          headers: { "referrer-policy": "no-referrer" },
        });
      }
      if (result.reason === "storage_unavailable") return unavailableResponse();
      return apiErrorResponse("BAD_REQUEST", {
        status: 400,
        message: "This one-time link is invalid or has expired.",
        headers: { "referrer-policy": "no-referrer" },
      });
    }

    const destination = new URL(result.redirectPath, configuration.origin);
    return new Response(null, {
      status: 303,
      headers: {
        "cache-control": "no-store",
        location: destination.toString(),
        "referrer-policy": "no-referrer",
        "set-cookie": serializeSessionCookie(result.token, {
          maxAgeSeconds: result.claims.expiresAt - result.claims.issuedAt,
          secure: configuration.secureCookies,
        }),
      },
    });
  } catch {
    return unavailableResponse();
  }
}

function unavailableResponse(): Response {
  return apiErrorResponse("UNAVAILABLE", {
    status: 503,
    message: "Authentication is temporarily unavailable.",
    headers: { "referrer-policy": "no-referrer" },
  });
}
