import { eq, lt, sql } from "drizzle-orm";
import type { getDb } from "../../db";
import { newsletterRateLimits } from "../../db/schema";
import { hmacSha256, sha256 } from "./crypto";
import { resolveAttestedClientAddress } from "../security/request-trust";
import type { AuthEnvironment } from "../auth/config";

type NewsletterDb = Awaited<ReturnType<typeof getDb>>;

export type NewsletterRateLimitScope = "email" | "ip";

export type RateLimitIncrement = {
  id: string;
  scope: NewsletterRateLimitScope;
  keyHash: string;
  windowStartedAt: Date;
  expiresAt: Date;
  now: Date;
};

export interface NewsletterRateLimitStore {
  increment(input: RateLimitIncrement): Promise<number>;
  prune?(now: Date): Promise<void>;
}

const LIMITS = {
  ip: { maximum: 5, windowMs: 15 * 60 * 1_000 },
  email: { maximum: 3, windowMs: 60 * 60 * 1_000 },
} as const;

const LOCAL_RATE_LIMIT_SECRET =
  "northline-local-preview-rate-limit-key-not-for-production";

export class RateLimitConfigurationError extends Error {
  constructor() {
    super(
      "RATE_LIMIT_SECRET must contain at least 32 characters in production.",
    );
    this.name = "RateLimitConfigurationError";
  }
}

export function resolveRateLimitSecret(
  configuredSecret: string | undefined,
  production: boolean,
): string {
  const secret = configuredSecret?.trim();
  if (secret && secret.length >= 32) return secret;
  if (production) throw new RateLimitConfigurationError();
  return LOCAL_RATE_LIMIT_SECRET;
}

export async function resolveClientAddress(
  headers: Headers,
  environment: AuthEnvironment = process.env as AuthEnvironment,
): Promise<string> {
  return resolveAttestedClientAddress(headers, environment);
}

export function createD1NewsletterRateLimitStore(
  db: NewsletterDb,
): NewsletterRateLimitStore {
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

      const [record] = await db
        .select({ count: newsletterRateLimits.count })
        .from(newsletterRateLimits)
        .where(eq(newsletterRateLimits.id, input.id))
        .limit(1);

      if (!record) {
        throw new Error("Rate-limit counter was not persisted.");
      }
      return record.count;
    },
  };
}

export async function enforceNewsletterRateLimits({
  store,
  email,
  clientAddress,
  secret,
  now = new Date(),
}: {
  store: NewsletterRateLimitStore;
  email: string;
  clientAddress: string;
  secret: string;
  now?: Date;
}): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const checks: Array<{
    scope: NewsletterRateLimitScope;
    value: string;
  }> = [{ scope: "email", value: email.toLowerCase() }];
  // Never collapse all un-attested traffic into one global "unavailable" IP
  // bucket. Email limiting remains active while the edge configuration is fixed.
  if (clientAddress !== "unavailable") {
    checks.unshift({ scope: "ip", value: clientAddress });
  }

  let allowed = true;
  let retryAfterSeconds = 0;

  await store.prune?.(now);

  for (const check of checks) {
    const policy = LIMITS[check.scope];
    const windowStartMs =
      Math.floor(now.getTime() / policy.windowMs) * policy.windowMs;
    const windowStartedAt = new Date(windowStartMs);
    const expiresAt = new Date(windowStartMs + policy.windowMs);
    const keyHash = await hmacSha256(
      secret,
      `newsletter:${check.scope}:${check.value}`,
    );
    const id = await sha256(
      `newsletter:${check.scope}:${keyHash}:${windowStartMs}`,
    );
    const count = await store.increment({
      id,
      scope: check.scope,
      keyHash,
      windowStartedAt,
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
