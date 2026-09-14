import { getDb } from "@/db";
import {
  createMagicLinkEmailSender,
} from "@/lib/auth/magic-link-email";
import {
  resolveStandardAuthConfiguration,
  safeStandardAuthRedirectPath,
} from "@/lib/auth/standard-config";
import { verifyAuthMutation } from "@/lib/auth/standard-csrf";
import {
  createD1AuthRateLimitStore,
  enforceMagicLinkRequestRateLimit,
} from "@/lib/auth/standard-rate-limit";
import {
  createD1StandardAuthRepository,
} from "@/lib/auth/standard-repository";
import {
  hashAuthRequestContext,
  normalizeEmail,
  requestMagicLink,
} from "@/lib/auth/standard-service";
import {
  NEWSLETTER_REQUEST_MAX_BYTES,
  readJsonBodyWithLimit,
  RequestBodyTooLargeError,
} from "@/lib/newsletter/body";
import { resolveAttestedClientAddress } from "@/lib/security/request-trust";
import { apiErrorResponse } from "@/lib/security/api";

export const runtime = "edge";

const GENERIC_RESPONSE = {
  message:
    "If the address is eligible, a one-time sign-in link will arrive shortly.",
};

type MagicLinkRequestBody = {
  email: string;
  intent: "register" | "sign_in";
  displayName?: string;
  redirectPath?: string;
};

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
            ? "Send the authentication request as JSON."
            : "The authentication request could not be verified.",
      },
    );
  }

  let body: unknown;
  try {
    body = await readJsonBodyWithLimit(
      request,
      Math.min(NEWSLETTER_REQUEST_MAX_BYTES, 4_096),
    );
  } catch (error) {
    return apiErrorResponse(
      error instanceof RequestBodyTooLargeError
        ? "PAYLOAD_TOO_LARGE"
        : "BAD_REQUEST",
      {
        status: error instanceof RequestBodyTooLargeError ? 413 : 400,
        message: "Send a valid authentication request.",
      },
    );
  }
  const input = parseMagicLinkRequest(body);
  if (!input) {
    return apiErrorResponse("BAD_REQUEST", {
      status: 400,
      message: "Send a valid authentication request.",
    });
  }

  let sender;
  try {
    sender = createMagicLinkEmailSender();
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Authentication email delivery is unavailable.",
    });
  }
  if (!sender) {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Authentication email delivery is unavailable.",
    });
  }

  try {
    const db = await getDb();
    const repository = createD1StandardAuthRepository(db);
    const clientAddress = await resolveAttestedClientAddress(request.headers);
    const rateLimit = await enforceMagicLinkRequestRateLimit({
      store: createD1AuthRateLimitStore(db),
      email: input.email,
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
          event: "MAGIC_LINK_REQUEST",
          decision: "DENY",
          reason: "RATE_LIMITED",
          clientIpHash: hashes.clientIpHash,
          userAgentHash: hashes.userAgentHash,
          metadata: { intent: input.intent },
          now: new Date(),
        });
      } catch {
        // The enumeration-safe rate-limit response remains authoritative.
      }
      // Keep the response indistinguishable from an accepted request.
      return Response.json(GENERIC_RESPONSE, {
        status: 202,
        headers: noStoreHeaders(),
      });
    }
    await requestMagicLink(input, {
      repository,
      sender,
      configuration,
      context: {
        clientAddress,
        userAgent: request.headers.get("user-agent"),
      },
    });
    return Response.json(GENERIC_RESPONSE, {
      status: 202,
      headers: noStoreHeaders(),
    });
  } catch {
    return apiErrorResponse("UNAVAILABLE", {
      status: 503,
      message: "Authentication storage is temporarily unavailable.",
    });
  }
}

function parseMagicLinkRequest(value: unknown): MagicLinkRequestBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some(
      (key) =>
        !["email", "intent", "displayName", "redirectPath"].includes(key),
    ) ||
    typeof record.email !== "string" ||
    !normalizeEmail(record.email) ||
    (record.intent !== "register" && record.intent !== "sign_in") ||
    (record.displayName !== undefined &&
      (typeof record.displayName !== "string" ||
        record.displayName.trim().length < 2 ||
        record.displayName.trim().length > 80 ||
        /[\u0000-\u001F\u007F]/.test(record.displayName))) ||
    (record.redirectPath !== undefined &&
      typeof record.redirectPath !== "string")
  ) {
    return null;
  }
  return {
    email: normalizeEmail(record.email)!,
    intent: record.intent,
    displayName: record.displayName?.trim(),
    redirectPath: safeStandardAuthRedirectPath(record.redirectPath ?? "/"),
  };
}

function noStoreHeaders(): HeadersInit {
  return {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  };
}
