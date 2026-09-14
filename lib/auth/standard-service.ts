import {
  hmacSha256Base64Url,
  randomBase64Url,
  sha256Base64Url,
} from "../security/crypto";
import {
  issueSessionToken,
  readSessionCookie,
  type SessionClaims,
  verifySessionToken,
} from "./session";
import type { MagicLinkEmailSender } from "./magic-link-email";
import {
  evaluateStaffMfaPolicy,
  safeStandardAuthRedirectPath,
  type StandardAuthConfiguration,
} from "./standard-config";
import type {
  MagicLinkAccount,
  MagicLinkPurpose,
  StandardAuthRepository,
} from "./standard-repository";

const MAGIC_LINK_TTL_MS = 15 * 60 * 1_000;
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const SESSION_ROTATION_SECONDS = 60 * 60;

export type MagicLinkIntent = "register" | "sign_in";

export type AuthRequestContext = {
  clientAddress: string;
  userAgent: string | null;
};

export type HashedAuthRequestContext = {
  clientIpHash: string | null;
  userAgentHash: string | null;
};

export type RequestMagicLinkResult = {
  accepted: true;
  outcome: "sent" | "suppressed" | "delivery_failed";
};

export type VerifyMagicLinkResult =
  | {
      ok: true;
      token: string;
      claims: SessionClaims;
      redirectPath: string;
    }
  | {
      ok: false;
      reason:
        | "invalid_or_expired"
        | "account_unavailable"
        | "staff_mfa_required"
        | "storage_unavailable";
    };

export type AuthenticatedStandardSession = {
  token: string;
  claims: SessionClaims;
};

export async function requestMagicLink(
  input: {
    email: string;
    intent: MagicLinkIntent;
    displayName?: string | null;
    redirectPath?: string | null;
    now?: Date;
  },
  {
    repository,
    sender,
    configuration,
    context,
  }: {
    repository: StandardAuthRepository;
    sender: MagicLinkEmailSender;
    configuration: StandardAuthConfiguration;
    context: AuthRequestContext;
  },
): Promise<RequestMagicLinkResult> {
  const now = input.now ?? new Date();
  const email = normalizeEmail(input.email);
  if (!email) throw new TypeError("A valid email address is required.");
  const purpose: MagicLinkPurpose =
    input.intent === "register" ? "REGISTER" : "SIGN_IN";
  const hashes = await hashAuthRequestContext(
    context,
    configuration.rateLimitSecret,
  );
  let account: MagicLinkAccount | null;
  if (purpose === "REGISTER" && configuration.allowRegistration) {
    account = await repository.findOrCreateRegistrationAccount(
      email,
      normalizeDisplayName(input.displayName, email),
      now,
    );
  } else {
    account = await repository.findMagicLinkAccountByEmail(email);
  }

  if (!isEligibleForChallenge(account, purpose, configuration)) {
    await repository.recordAudit({
      event: "MAGIC_LINK_REQUEST",
      decision: "DENY",
      reason: "INELIGIBLE_OR_UNKNOWN",
      clientIpHash: hashes.clientIpHash,
      userAgentHash: hashes.userAgentHash,
      metadata: { intent: input.intent },
      now,
    });
    return { accepted: true, outcome: "suppressed" };
  }

  const token = randomBase64Url(32);
  const tokenHash = await sha256Base64Url(token);
  const emailHash = await hmacSha256Base64Url(
    configuration.rateLimitSecret,
    `auth-email:${email}`,
  );
  const challengeId = `auth_ch_${crypto.randomUUID()}`;
  const redirectPath = safeStandardAuthRedirectPath(
    input.redirectPath ?? "/",
  );
  await repository.createChallenge({
    id: challengeId,
    userId: account.userId,
    emailHash,
    purpose,
    tokenHash,
    redirectPath,
    requestedIpHash: hashes.clientIpHash,
    requestedUserAgentHash: hashes.userAgentHash,
    createdAt: now,
    expiresAt: new Date(now.getTime() + MAGIC_LINK_TTL_MS),
  });

  const magicLink = new URL("/api/auth/magic-link/verify", configuration.origin);
  magicLink.searchParams.set("token", token);
  try {
    await sender.send({
      email,
      intent: input.intent,
      magicLinkUrl: magicLink.toString(),
      idempotencyKey: `auth-magic-link-${tokenHash}`,
    });
    await repository.recordAudit({
      event: "MAGIC_LINK_REQUEST",
      decision: "ALLOW",
      reason: "DELIVERED",
      userId: account.userId,
      clientIpHash: hashes.clientIpHash,
      userAgentHash: hashes.userAgentHash,
      metadata: { intent: input.intent },
      now,
    });
    return { accepted: true, outcome: "sent" };
  } catch {
    await repository.invalidateChallenge(challengeId, now);
    await repository.recordAudit({
      event: "MAGIC_LINK_REQUEST",
      decision: "ERROR",
      reason: "DELIVERY_FAILED",
      userId: account.userId,
      clientIpHash: hashes.clientIpHash,
      userAgentHash: hashes.userAgentHash,
      metadata: { intent: input.intent },
      now,
    });
    return { accepted: true, outcome: "delivery_failed" };
  }
}

export async function verifyMagicLink(
  token: string,
  {
    repository,
    configuration,
    context,
    now = new Date(),
  }: {
    repository: StandardAuthRepository;
    configuration: StandardAuthConfiguration;
    context: AuthRequestContext;
    now?: Date;
  },
): Promise<VerifyMagicLinkResult> {
  const hashes = await hashAuthRequestContext(
    context,
    configuration.rateLimitSecret,
  );
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    await safeAudit(repository, {
      event: "MAGIC_LINK_VERIFY",
      decision: "DENY",
      reason: "MALFORMED",
      clientIpHash: hashes.clientIpHash,
      userAgentHash: hashes.userAgentHash,
      now,
    });
    return { ok: false, reason: "invalid_or_expired" };
  }

  let challenge;
  try {
    challenge = await repository.consumeChallenge(
      await sha256Base64Url(token),
      now,
    );
  } catch {
    return { ok: false, reason: "storage_unavailable" };
  }
  if (!challenge) {
    await safeAudit(repository, {
      event: "MAGIC_LINK_VERIFY",
      decision: "DENY",
      reason: "INVALID_EXPIRED_OR_REPLAYED",
      clientIpHash: hashes.clientIpHash,
      userAgentHash: hashes.userAgentHash,
      now,
    });
    return { ok: false, reason: "invalid_or_expired" };
  }

  if (challenge.purpose === "REGISTER") {
    try {
      await repository.activateVerifiedAccount(challenge.userId, now);
    } catch {
      return { ok: false, reason: "storage_unavailable" };
    }
  }
  const account = await repository.findMagicLinkAccountByUserId(
    challenge.userId,
  );
  if (
    !account ||
    account.disabledAt ||
    !account.emailVerifiedAt ||
    account.status.trim().toLowerCase() !== "active"
  ) {
    await safeAudit(repository, {
      event: "MAGIC_LINK_VERIFY",
      decision: "DENY",
      reason: "ACCOUNT_UNAVAILABLE",
      userId: challenge.userId,
      clientIpHash: hashes.clientIpHash,
      userAgentHash: hashes.userAgentHash,
      now,
    });
    return { ok: false, reason: "account_unavailable" };
  }

  const staffMfa = evaluateStaffMfaPolicy({
    isStaff: await repository.isStaffUser(account.userId),
    production: configuration.production,
    policyRequired: configuration.staffMfaRequired,
    provider: configuration.mfaProvider,
    mfaVerified: false,
  });
  if (!staffMfa.allowed) {
    await safeAudit(repository, {
      event: "MAGIC_LINK_VERIFY",
      decision: "DENY",
      reason: `STAFF_MFA_${staffMfa.reason.toUpperCase()}`,
      userId: account.userId,
      clientIpHash: hashes.clientIpHash,
      userAgentHash: hashes.userAgentHash,
      now,
    });
    return { ok: false, reason: "staff_mfa_required" };
  }

  try {
    const issued = await issueSessionToken(
      {
        userId: account.userId,
        email: account.email,
        displayName: account.displayName,
        authVersion: 1,
        now,
        ttlSeconds: SESSION_TTL_SECONDS,
        rotationSeconds: SESSION_ROTATION_SECONDS,
      },
      configuration.sessionSecret,
    );
    const sessionIdHash = await hmacSha256Base64Url(
      configuration.rateLimitSecret,
      `session:${issued.claims.sessionId}`,
    );
    await repository.createSession({
      id: issued.claims.sessionId,
      userId: account.userId,
      tokenHash: await sha256Base64Url(issued.token),
      rotationFamilyHash: await sha256Base64Url(randomBase64Url(32)),
      userAgentHash: hashes.userAgentHash,
      clientIpHash: hashes.clientIpHash,
      createdAt: now,
      expiresAt: new Date(issued.claims.expiresAt * 1_000),
    });
    await repository.recordAudit({
      event: "SESSION_CREATED",
      decision: "ALLOW",
      reason: "MAGIC_LINK",
      userId: account.userId,
      sessionIdHash,
      clientIpHash: hashes.clientIpHash,
      userAgentHash: hashes.userAgentHash,
      metadata: { purpose: challenge.purpose },
      now,
    });
    return {
      ok: true,
      token: issued.token,
      claims: issued.claims,
      redirectPath: safeStandardAuthRedirectPath(challenge.redirectPath ?? "/"),
    };
  } catch {
    return { ok: false, reason: "storage_unavailable" };
  }
}

export async function authenticateStandardRequest(
  request: Request,
  {
    repository,
    configuration,
    now = new Date(),
  }: {
    repository: StandardAuthRepository;
    configuration: StandardAuthConfiguration;
    now?: Date;
  },
): Promise<AuthenticatedStandardSession | null> {
  const token = readSessionCookie(request.headers.get("cookie"));
  if (!token) return null;
  const verification = await verifySessionToken(token, {
    secret: configuration.sessionSecret,
    stateReader: repository,
    now,
  });
  return verification.valid
    ? { token, claims: verification.claims }
    : null;
}

export async function hashAuthRequestContext(
  context: AuthRequestContext,
  secret: string,
): Promise<HashedAuthRequestContext> {
  const userAgent = context.userAgent?.trim().slice(0, 512);
  return {
    clientIpHash:
      context.clientAddress === "unavailable"
        ? null
        : await hmacSha256Base64Url(
            secret,
            `auth-ip:${context.clientAddress}`,
          ),
    userAgentHash: userAgent
      ? await hmacSha256Base64Url(secret, `auth-ua:${userAgent}`)
      : null,
  };
}

export function normalizeEmail(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return normalized.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) &&
    !/[\u0000-\u001F\u007F]/.test(normalized)
    ? normalized
    : null;
}

function normalizeDisplayName(
  value: string | null | undefined,
  email: string,
): string {
  const normalized = value?.trim();
  if (
    normalized &&
    normalized.length >= 2 &&
    normalized.length <= 80 &&
    !/[\u0000-\u001F\u007F]/.test(normalized)
  ) {
    return normalized;
  }
  const localPart = email.split("@", 1)[0].replace(/[._-]+/g, " ").trim();
  return localPart.length >= 2 && localPart.length <= 80
    ? localPart
    : "Northline reader";
}

function isEligibleForChallenge(
  account: MagicLinkAccount | null,
  purpose: MagicLinkPurpose,
  configuration: StandardAuthConfiguration,
): account is MagicLinkAccount {
  if (!account || account.disabledAt) return false;
  if (purpose === "REGISTER") {
    return (
      configuration.allowRegistration &&
      ["pending", "active"].includes(account.status.trim().toLowerCase())
    );
  }
  return (
    account.status.trim().toLowerCase() === "active" &&
    Boolean(account.emailVerifiedAt)
  );
}

async function safeAudit(
  repository: StandardAuthRepository,
  input: Parameters<StandardAuthRepository["recordAudit"]>[0],
): Promise<void> {
  try {
    await repository.recordAudit(input);
  } catch {
    // Authentication denial remains authoritative when audit storage is down.
  }
}
