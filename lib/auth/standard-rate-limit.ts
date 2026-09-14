import { eq, lt, sql } from "drizzle-orm";
import type { getDb } from "../../db";
import { newsletterRateLimits } from "../../db/schema";
import {
  hmacSha256Base64Url,
  sha256Base64Url,
} from "../security/crypto";

type NorthlineDb = Awaited<ReturnType<typeof getDb>>;

export type AuthRateLimitIncrement = {
  id: string;
  scope: "auth_email" | "auth_ip" | "auth_verify_ip";
  keyHash: string;
  windowStartedAt: Date;
  expiresAt: Date;
  now: Date;
};

export interface AuthRateLimitStore {
  increment(input: AuthRateLimitIncrement): Promise<number>;
  prune?(now: Date): Promise<void>;
}

const REQUEST_POLICIES = {
  auth_email: { maximum: 3, windowMs: 60 * 60 * 1_000 },
  auth_ip: { maximum: 10, windowMs: 15 * 60 * 1_000 },
} as const;

const VERIFY_POLICY = {
  maximum: 20,
  windowMs: 15 * 60 * 1_000,
} as const;

export function createD1AuthRateLimitStore(
  db: NorthlineDb,
): AuthRateLimitStore {
  return {
    async prune(now) {
      await db
        .delete(newsletterRateLimits)
        .where(lt(newsletterRateLimits.expiresAt, now));
    },
    async increment(input) {
      await db
        .insert(newsletterRateLimits)
        .values({
          id: input.id,
          scope: input.scope,
          keyHash: input.keyHash,
          windowStartedAt: input.windowStartedAt,
          count: 1,
          expiresAt: input.expiresAt,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .onConflictDoUpdate({
          target: newsletterRateLimits.id,
          set: {
            count: sql`${newsletterRateLimits.count} + 1`,
            updatedAt: input.now,
          },
        });
      const [row] = await db
        .select({ count: newsletterRateLimits.count })
        .from(newsletterRateLimits)
        .where(eq(newsletterRateLimits.id, input.id))
        .limit(1);
      if (!row) throw new Error("Authentication rate limit was not persisted.");
      return row.count;
    },
  };
}

export async function enforceMagicLinkRequestRateLimit({
  store,
  email,
  clientAddress,
  secret,
  now = new Date(),
}: {
  store: AuthRateLimitStore;
  email: string;
  clientAddress: string;
  secret: string;
  now?: Date;
}): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  assertSecret(secret);
  const checks: Array<{
    scope: keyof typeof REQUEST_POLICIES;
    value: string;
  }> = [{ scope: "auth_email", value: email.trim().toLowerCase() }];
  if (clientAddress !== "unavailable") {
    checks.unshift({ scope: "auth_ip", value: clientAddress });
  }
  return enforceChecks(store, checks, REQUEST_POLICIES, secret, now);
}

export async function enforceMagicLinkVerifyRateLimit({
  store,
  clientAddress,
  secret,
  now = new Date(),
}: {
  store: AuthRateLimitStore;
  clientAddress: string;
  secret: string;
  now?: Date;
}): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  assertSecret(secret);
  if (clientAddress === "unavailable") {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return enforceChecks(
    store,
    [{ scope: "auth_verify_ip" as const, value: clientAddress }],
    { auth_verify_ip: VERIFY_POLICY },
    secret,
    now,
  );
}

async function enforceChecks<
  Scope extends AuthRateLimitIncrement["scope"],
>(
  store: AuthRateLimitStore,
  checks: readonly { scope: Scope; value: string }[],
  policies: Record<Scope, { maximum: number; windowMs: number }>,
  secret: string,
  now: Date,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  await store.prune?.(now);
  let allowed = true;
  let retryAfterSeconds = 0;
  for (const check of checks) {
    const policy = policies[check.scope];
    const windowStartMs =
      Math.floor(now.getTime() / policy.windowMs) * policy.windowMs;
    const expiresAt = new Date(windowStartMs + policy.windowMs);
    const keyHash = await hmacSha256Base64Url(
      secret,
      `${check.scope}:${check.value}`,
    );
    const id = await sha256Base64Url(
      `${check.scope}:${keyHash}:${windowStartMs}`,
    );
    const count = await store.increment({
      id,
      scope: check.scope,
      keyHash,
      windowStartedAt: new Date(windowStartMs),
      expiresAt,
      now,
    });
    if (count > policy.maximum) {
      allowed = false;
      retryAfterSeconds = Math.max(
        retryAfterSeconds,
        Math.ceil((expiresAt.getTime() - now.getTime()) / 1_000),
      );
    }
  }
  return { allowed, retryAfterSeconds };
}

function assertSecret(secret: string): void {
  if (secret.trim().length < 32) {
    throw new TypeError(
      "Authentication rate-limit secret must contain at least 32 characters.",
    );
  }
}
