import { describe, expect, it, vi } from "vitest";
import type { MagicLinkEmailSender } from "../../lib/auth/magic-link-email";
import type { StandardAuthConfiguration } from "../../lib/auth/standard-config";
import type {
  AuthAuditInput,
  ConsumedMagicLinkChallenge,
  MagicLinkAccount,
  PersistedSession,
  StandardAuthRepository,
} from "../../lib/auth/standard-repository";
import {
  requestMagicLink,
  verifyMagicLink,
} from "../../lib/auth/standard-service";
import type { SessionState } from "../../lib/auth/session";

const now = new Date("2026-07-24T12:00:00.000Z");
const configuration: StandardAuthConfiguration = {
  enabled: true,
  allowRegistration: true,
  origin: "https://northline.example",
  production: true,
  secureCookies: true,
  sessionSecret: "session-secret-with-at-least-thirty-two-characters",
  csrfSecret: "csrf-secret-with-at-least-thirty-two-characters",
  rateLimitSecret: "rate-secret-with-at-least-thirty-two-characters",
  staffMfaRequired: false,
  mfaProvider: null,
};
const context = {
  clientAddress: "203.0.113.8",
  userAgent: "Northline test browser",
};

describe("standard magic-link authentication", () => {
  it("suppresses unknown sign-in requests without sending a message", async () => {
    const repository = new MemoryAuthRepository(null);
    const sender = senderSpy();

    const result = await requestMagicLink(
      {
        email: "unknown@example.com",
        intent: "sign_in",
        now,
      },
      { repository, sender, configuration, context },
    );

    expect(result).toEqual({ accepted: true, outcome: "suppressed" });
    expect(sender.send).not.toHaveBeenCalled();
    expect(repository.audits).toMatchObject([
      {
        event: "MAGIC_LINK_REQUEST",
        decision: "DENY",
        reason: "INELIGIBLE_OR_UNKNOWN",
      },
    ]);
  });

  it("stores only a token hash, delivers a link, and rejects replay", async () => {
    const repository = new MemoryAuthRepository(activeAccount());
    const sender = senderSpy();
    await requestMagicLink(
      {
        email: "reader@example.com",
        intent: "sign_in",
        redirectPath: "/latest?edition=us",
        now,
      },
      { repository, sender, configuration, context },
    );

    expect(sender.send).toHaveBeenCalledOnce();
    const delivered = vi.mocked(sender.send).mock.calls[0][0];
    const rawToken = new URL(delivered.magicLinkUrl).searchParams.get("token");
    expect(rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(repository.challenge?.tokenHash).not.toBe(rawToken);
    expect(JSON.stringify(repository.challenge)).not.toContain(rawToken);

    const verified = await verifyMagicLink(rawToken!, {
      repository,
      configuration,
      context,
      now: new Date("2026-07-24T12:01:00.000Z"),
    });
    expect(verified.ok).toBe(true);
    if (!verified.ok) throw new Error("Expected successful verification.");
    expect(verified.redirectPath).toBe("/latest?edition=us");
    expect(repository.createdSessions).toHaveLength(1);
    expect(repository.createdSessions[0].tokenHash).not.toBe(verified.token);
    expect(repository.audits.at(-1)).toMatchObject({
      event: "SESSION_CREATED",
      decision: "ALLOW",
      reason: "MAGIC_LINK",
    });

    await expect(
      verifyMagicLink(rawToken!, {
        repository,
        configuration,
        context,
        now: new Date("2026-07-24T12:02:00.000Z"),
      }),
    ).resolves.toEqual({ ok: false, reason: "invalid_or_expired" });
  });

  it("invalidates a challenge when delivery fails", async () => {
    const repository = new MemoryAuthRepository(activeAccount());
    const sender: MagicLinkEmailSender = {
      async send() {
        throw new Error("provider unavailable");
      },
    };
    const result = await requestMagicLink(
      { email: "reader@example.com", intent: "sign_in", now },
      { repository, sender, configuration, context },
    );
    expect(result.outcome).toBe("delivery_failed");
    expect(repository.challenge?.invalidated).toBe(true);
    expect(repository.audits.at(-1)).toMatchObject({
      decision: "ERROR",
      reason: "DELIVERY_FAILED",
    });
  });

  it("does not use registration to revive a suspended account", async () => {
    const suspended = activeAccount();
    suspended.status = "suspended";
    const repository = new MemoryAuthRepository(suspended);
    const sender = senderSpy();
    const result = await requestMagicLink(
      {
        email: "reader@example.com",
        intent: "register",
        now,
      },
      { repository, sender, configuration, context },
    );
    expect(result.outcome).toBe("suppressed");
    expect(sender.send).not.toHaveBeenCalled();
    expect(repository.account?.status).toBe("suspended");
  });

  it("fails closed for production staff without an MFA ceremony", async () => {
    const repository = new MemoryAuthRepository(activeAccount());
    repository.staff = true;
    const sender = senderSpy();
    await requestMagicLink(
      { email: "reader@example.com", intent: "sign_in", now },
      { repository, sender, configuration, context },
    );
    const rawToken = new URL(
      vi.mocked(sender.send).mock.calls[0][0].magicLinkUrl,
    ).searchParams.get("token")!;
    await expect(
      verifyMagicLink(rawToken, {
        repository,
        configuration,
        context,
        now: new Date("2026-07-24T12:01:00.000Z"),
      }),
    ).resolves.toEqual({ ok: false, reason: "staff_mfa_required" });
    expect(repository.createdSessions).toHaveLength(0);
    expect(repository.audits.at(-1)?.reason).toBe(
      "STAFF_MFA_POLICY_NOT_ENABLED",
    );
  });
});

function activeAccount(): MagicLinkAccount {
  return {
    userId: "usr_reader_12345678",
    email: "reader@example.com",
    displayName: "Reader",
    status: "active",
    emailVerifiedAt: now,
    disabledAt: null,
  };
}

function senderSpy(): MagicLinkEmailSender {
  return { send: vi.fn(async () => undefined) };
}

class MemoryAuthRepository implements StandardAuthRepository {
  account: MagicLinkAccount | null;
  audits: AuthAuditInput[] = [];
  challenge:
    | {
        id: string;
        userId: string;
        purpose: "REGISTER" | "SIGN_IN";
        tokenHash: string;
        redirectPath: string;
        expiresAt: Date;
        consumed: boolean;
        invalidated: boolean;
      }
    | null = null;
  createdSessions: Array<{
    id: string;
    userId: string;
    tokenHash: string;
    rotationFamilyHash: string;
    userAgentHash: string | null;
    clientIpHash: string | null;
    createdAt: Date;
    expiresAt: Date;
  }> = [];
  staff = false;

  constructor(account: MagicLinkAccount | null) {
    this.account = account;
  }

  async findMagicLinkAccountByEmail(email: string) {
    return this.account?.email === email ? this.account : null;
  }

  async findMagicLinkAccountByUserId(userId: string) {
    return this.account?.userId === userId ? this.account : null;
  }

  async findOrCreateRegistrationAccount(
    email: string,
    displayName: string,
    createdAt: Date,
  ) {
    this.account ??= {
      userId: "usr_created_12345678",
      email,
      displayName,
      status: "pending",
      emailVerifiedAt: null,
      disabledAt: null,
    };
    void createdAt;
    return this.account;
  }

  async createChallenge(input: {
    id: string;
    userId: string;
    emailHash: string;
    purpose: "REGISTER" | "SIGN_IN";
    tokenHash: string;
    redirectPath: string;
    requestedIpHash: string | null;
    requestedUserAgentHash: string | null;
    createdAt: Date;
    expiresAt: Date;
  }) {
    this.challenge = {
      id: input.id,
      userId: input.userId,
      purpose: input.purpose,
      tokenHash: input.tokenHash,
      redirectPath: input.redirectPath,
      expiresAt: input.expiresAt,
      consumed: false,
      invalidated: false,
    };
  }

  async consumeChallenge(
    tokenHash: string,
    consumedAt: Date,
  ): Promise<ConsumedMagicLinkChallenge | null> {
    const challenge = this.challenge;
    if (
      !challenge ||
      challenge.tokenHash !== tokenHash ||
      challenge.consumed ||
      challenge.invalidated ||
      challenge.expiresAt <= consumedAt
    ) {
      return null;
    }
    challenge.consumed = true;
    return {
      id: challenge.id,
      userId: challenge.userId,
      purpose: challenge.purpose,
      redirectPath: challenge.redirectPath,
    };
  }

  async invalidateChallenge(id: string) {
    if (this.challenge?.id === id) this.challenge.invalidated = true;
  }

  async activateVerifiedAccount(userId: string, activatedAt: Date) {
    if (this.account?.userId === userId) {
      this.account.status = "active";
      this.account.emailVerifiedAt = activatedAt;
    }
  }

  async isStaffUser() {
    return this.staff;
  }

  async createSession(
    input: MemoryAuthRepository["createdSessions"][number],
  ) {
    this.createdSessions.push(input);
  }

  async readSessionState(sessionId: string): Promise<SessionState | null> {
    const session = this.createdSessions.find((entry) => entry.id === sessionId);
    return session
      ? {
          sessionId,
          userId: session.userId,
          authVersion: 1,
          expiresAt: Math.floor(session.expiresAt.getTime() / 1_000),
          revokedAt: null,
        }
      : null;
  }

  async listSessions(): Promise<readonly PersistedSession[]> {
    return [];
  }

  async revokeSession() {
    return false;
  }

  async recordAudit(input: AuthAuditInput) {
    this.audits.push(input);
  }
}
