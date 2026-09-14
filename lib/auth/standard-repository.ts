import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";
import type { getDb } from "../../db";
import { users } from "../../db/schema";
import {
  authAccounts,
  authSessions,
  roles,
  userRoles,
} from "../../db/schema-v2";
import {
  authAuditEvents,
  authChallenges,
} from "../../db/schema-v3-auth";
import type {
  SessionState,
  SessionStateReader,
} from "./session";

type NorthlineDb = Awaited<ReturnType<typeof getDb>>;

export type MagicLinkPurpose = "REGISTER" | "SIGN_IN";

export type MagicLinkAccount = {
  userId: string;
  email: string;
  displayName: string;
  status: string;
  emailVerifiedAt: Date | null;
  disabledAt: Date | null;
};

export type ConsumedMagicLinkChallenge = {
  id: string;
  userId: string;
  purpose: MagicLinkPurpose;
  redirectPath: string | null;
};

export type PersistedSession = {
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revocationReason: string | null;
};

export type AuthAuditInput = {
  event: string;
  decision: "ALLOW" | "DENY" | "ERROR";
  reason?: string | null;
  userId?: string | null;
  sessionIdHash?: string | null;
  clientIpHash?: string | null;
  userAgentHash?: string | null;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
  now: Date;
};

export interface StandardAuthRepository extends SessionStateReader {
  findMagicLinkAccountByEmail(email: string): Promise<MagicLinkAccount | null>;
  findMagicLinkAccountByUserId(
    userId: string,
  ): Promise<MagicLinkAccount | null>;
  findOrCreateRegistrationAccount(
    email: string,
    displayName: string,
    now: Date,
  ): Promise<MagicLinkAccount | null>;
  createChallenge(input: {
    id: string;
    userId: string;
    emailHash: string;
    purpose: MagicLinkPurpose;
    tokenHash: string;
    redirectPath: string;
    requestedIpHash: string | null;
    requestedUserAgentHash: string | null;
    createdAt: Date;
    expiresAt: Date;
  }): Promise<void>;
  consumeChallenge(
    tokenHash: string,
    now: Date,
  ): Promise<ConsumedMagicLinkChallenge | null>;
  invalidateChallenge(id: string, now: Date): Promise<void>;
  activateVerifiedAccount(userId: string, now: Date): Promise<void>;
  isStaffUser(userId: string): Promise<boolean>;
  createSession(input: {
    id: string;
    userId: string;
    tokenHash: string;
    rotationFamilyHash: string;
    userAgentHash: string | null;
    clientIpHash: string | null;
    createdAt: Date;
    expiresAt: Date;
  }): Promise<void>;
  listSessions(userId: string): Promise<readonly PersistedSession[]>;
  revokeSession(input: {
    sessionId: string;
    userId: string;
    reason: string;
    now: Date;
  }): Promise<boolean>;
  recordAudit(input: AuthAuditInput): Promise<void>;
}

const MAGIC_LINK_PROVIDER = "magic_link";

export function createD1StandardAuthRepository(
  db: NorthlineDb,
): StandardAuthRepository {
  const repository: StandardAuthRepository = {
    async findMagicLinkAccountByEmail(email) {
      const rows = await db
        .select(accountSelection)
        .from(authAccounts)
        .innerJoin(users, eq(authAccounts.userId, users.id))
        .where(
          and(
            eq(authAccounts.provider, MAGIC_LINK_PROVIDER),
            sql`lower(${users.email}) = ${email.trim().toLowerCase()}`,
          ),
        )
        .limit(2);
      return rows.length === 1 ? normalizeAccount(rows[0]) : null;
    },

    async findMagicLinkAccountByUserId(userId) {
      const rows = await db
        .select(accountSelection)
        .from(authAccounts)
        .innerJoin(users, eq(authAccounts.userId, users.id))
        .where(
          and(
            eq(authAccounts.provider, MAGIC_LINK_PROVIDER),
            eq(authAccounts.userId, userId),
          ),
        )
        .limit(2);
      return rows.length === 1 ? normalizeAccount(rows[0]) : null;
    },

    async findOrCreateRegistrationAccount(email, displayName, now) {
      const existing = await repository.findMagicLinkAccountByEmail(email);
      if (existing) return existing;

      const matchingUsers = await db
        .select({
          userId: users.id,
          email: users.email,
          displayName: users.displayName,
          status: users.status,
        })
        .from(users)
        .where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`)
        .limit(2);
      if (matchingUsers.length > 1) return null;

      const userId = matchingUsers[0]?.userId ?? `usr_${crypto.randomUUID()}`;
      const accountId = `acct_${crypto.randomUUID()}`;
      try {
        if (matchingUsers[0]) {
          await db.insert(authAccounts).values({
            id: accountId,
            userId,
            provider: MAGIC_LINK_PROVIDER,
            providerAccountId: email,
            emailVerifiedAt: null,
            createdAt: now,
            updatedAt: now,
          });
        } else {
          await db.batch([
            db.insert(users).values({
              id: userId,
              email,
              displayName,
              role: "Reader",
              status: "pending",
              createdAt: now,
              updatedAt: now,
            }),
            db.insert(authAccounts).values({
              id: accountId,
              userId,
              provider: MAGIC_LINK_PROVIDER,
              providerAccountId: email,
              emailVerifiedAt: null,
              createdAt: now,
              updatedAt: now,
            }),
          ]);
        }
      } catch {
        // A concurrent request may have created the normalized identity.
        return repository.findMagicLinkAccountByEmail(email);
      }
      return repository.findMagicLinkAccountByEmail(email);
    },

    async createChallenge(input) {
      await db.batch([
        db
          .update(authChallenges)
          .set({ invalidatedAt: input.createdAt })
          .where(
            and(
              eq(authChallenges.emailHash, input.emailHash),
              eq(authChallenges.purpose, input.purpose),
              isNull(authChallenges.consumedAt),
              isNull(authChallenges.invalidatedAt),
            ),
          ),
        db.insert(authChallenges).values(input),
      ]);
    },

    async consumeChallenge(tokenHash, now) {
      const rows = await db
        .update(authChallenges)
        .set({ consumedAt: now })
        .where(
          and(
            eq(authChallenges.tokenHash, tokenHash),
            isNull(authChallenges.consumedAt),
            isNull(authChallenges.invalidatedAt),
            gt(authChallenges.expiresAt, now),
            inArray(authChallenges.purpose, ["REGISTER", "SIGN_IN"]),
          ),
        )
        .returning({
          id: authChallenges.id,
          userId: authChallenges.userId,
          purpose: authChallenges.purpose,
          redirectPath: authChallenges.redirectPath,
        });
      const row = rows[0];
      if (
        !row?.userId ||
        (row.purpose !== "REGISTER" && row.purpose !== "SIGN_IN")
      ) {
        return null;
      }
      return {
        id: row.id,
        userId: row.userId,
        purpose: row.purpose,
        redirectPath: row.redirectPath,
      };
    },

    async invalidateChallenge(id, now) {
      await db
        .update(authChallenges)
        .set({ invalidatedAt: now })
        .where(
          and(
            eq(authChallenges.id, id),
            isNull(authChallenges.invalidatedAt),
          ),
        );
    },

    async activateVerifiedAccount(userId, now) {
      await db.batch([
        db
          .update(authAccounts)
          .set({ emailVerifiedAt: now, updatedAt: now })
          .where(
            and(
              eq(authAccounts.userId, userId),
              eq(authAccounts.provider, MAGIC_LINK_PROVIDER),
              isNull(authAccounts.disabledAt),
            ),
          ),
        db
          .update(users)
          .set({ status: "active", updatedAt: now })
          .where(
            and(
              eq(users.id, userId),
              inArray(users.status, ["pending", "active"]),
            ),
          ),
      ]);
    },

    async isStaffUser(userId) {
      const [row] = await db
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(
          and(
            eq(userRoles.userId, userId),
            isNull(userRoles.organizationId),
            isNull(userRoles.revokedAt),
            inArray(roles.scope, ["STAFF", "GLOBAL"]),
          ),
        )
        .limit(1);
      return Boolean(row);
    },

    async createSession(input) {
      await db.insert(authSessions).values({
        id: input.id,
        userId: input.userId,
        tokenHash: input.tokenHash,
        rotationFamilyHash: input.rotationFamilyHash,
        userAgentHash: input.userAgentHash,
        clientIpHash: input.clientIpHash,
        createdAt: input.createdAt,
        lastSeenAt: input.createdAt,
        expiresAt: input.expiresAt,
      });
    },

    async readSessionState(sessionId) {
      const [row] = await db
        .select({
          sessionId: authSessions.id,
          userId: authSessions.userId,
          expiresAt: authSessions.expiresAt,
          revokedAt: authSessions.revokedAt,
          userStatus: users.status,
        })
        .from(authSessions)
        .innerJoin(users, eq(authSessions.userId, users.id))
        .where(eq(authSessions.id, sessionId))
        .limit(1);
      if (!row || row.userStatus.trim().toLowerCase() !== "active") {
        return null;
      }
      const account = await repository.findMagicLinkAccountByUserId(row.userId);
      if (!account || account.disabledAt || !account.emailVerifiedAt) return null;
      return {
        sessionId: row.sessionId,
        userId: row.userId,
        authVersion: 1,
        expiresAt: unixSeconds(row.expiresAt),
        revokedAt: row.revokedAt ? unixSeconds(row.revokedAt) : null,
      } satisfies SessionState;
    },

    async listSessions(userId) {
      return db
        .select({
          id: authSessions.id,
          createdAt: authSessions.createdAt,
          lastSeenAt: authSessions.lastSeenAt,
          expiresAt: authSessions.expiresAt,
          revokedAt: authSessions.revokedAt,
          revocationReason: authSessions.revocationReason,
        })
        .from(authSessions)
        .where(eq(authSessions.userId, userId))
        .orderBy(desc(authSessions.createdAt))
        .limit(50);
    },

    async revokeSession(input) {
      const rows = await db
        .update(authSessions)
        .set({
          revokedAt: input.now,
          revocationReason: input.reason,
        })
        .where(
          and(
            eq(authSessions.id, input.sessionId),
            eq(authSessions.userId, input.userId),
            isNull(authSessions.revokedAt),
          ),
        )
        .returning({ id: authSessions.id });
      return rows.length === 1;
    },

    async recordAudit(input) {
      await db.insert(authAuditEvents).values({
        id: `auth_evt_${crypto.randomUUID()}`,
        userId: input.userId ?? null,
        event: input.event,
        decision: input.decision,
        reason: input.reason ?? null,
        sessionIdHash: input.sessionIdHash ?? null,
        clientIpHash: input.clientIpHash ?? null,
        userAgentHash: input.userAgentHash ?? null,
        metadataJson: stableMetadata(input.metadata),
        occurredAt: input.now,
      });
    },
  };
  return repository;
}

const accountSelection = {
  userId: users.id,
  email: users.email,
  displayName: users.displayName,
  status: users.status,
  emailVerifiedAt: authAccounts.emailVerifiedAt,
  disabledAt: authAccounts.disabledAt,
};

function normalizeAccount(
  row: {
    userId: string;
    email: string;
    displayName: string | null;
    status: string;
    emailVerifiedAt: Date | null;
    disabledAt: Date | null;
  },
): MagicLinkAccount {
  const email = row.email.trim().toLowerCase();
  return {
    ...row,
    email,
    displayName: row.displayName?.trim() || email,
  };
}

function stableMetadata(
  metadata: AuthAuditInput["metadata"],
): string {
  if (!metadata) return "{}";
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(metadata)
        .filter(([key]) => /^[a-z][a-z0-9_]{0,63}$/.test(key))
        .sort(([left], [right]) => left.localeCompare(right)),
    ),
  );
}

function unixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1_000);
}
