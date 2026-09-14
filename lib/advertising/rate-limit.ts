import { eq, lt, sql } from "drizzle-orm";
import type { getDb } from "../../db";
import { newsletterRateLimits } from "../../db/schema";
import { hmacSha256Base64Url, sha256Base64Url } from "../security/crypto";

type Database = Awaited<ReturnType<typeof getDb>>;

const policies = {
  ip: { maximum: 8, windowMs: 30 * 60 * 1_000 },
  email: { maximum: 3, windowMs: 24 * 60 * 60 * 1_000 },
} as const;

export async function enforceAdvertisingLeadRateLimit(input: {
  db: Database;
  email: string;
  clientAddress: string;
  secret: string;
  now?: Date;
}): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  if (input.secret.length < 32) throw new Error("rate-limit secret is too short");
  const now = input.now ?? new Date();
  const checks: Array<{ scope: keyof typeof policies; value: string }> = [
    { scope: "email", value: input.email.toLowerCase() },
  ];
  if (input.clientAddress !== "unavailable") {
    checks.unshift({ scope: "ip", value: input.clientAddress });
  }
  await input.db
    .delete(newsletterRateLimits)
    .where(lt(newsletterRateLimits.expiresAt, now));

  let allowed = true;
  let retryAfterSeconds = 0;
  for (const check of checks) {
    const policy = policies[check.scope];
    const windowStartMs =
      Math.floor(now.getTime() / policy.windowMs) * policy.windowMs;
    const keyHash = await hmacSha256Base64Url(
      input.secret,
      `advertising-lead:${check.scope}:${check.value}`,
    );
    const id = await sha256Base64Url(
      `advertising-lead:${check.scope}:${keyHash}:${windowStartMs}`,
    );
    const expiresAt = new Date(windowStartMs + policy.windowMs);
    await input.db
      .insert(newsletterRateLimits)
      .values({
        id,
        scope: `advertising-${check.scope}`,
        keyHash,
        windowStartedAt: new Date(windowStartMs),
        count: 1,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: newsletterRateLimits.id,
        set: {
          count: sql`${newsletterRateLimits.count} + 1`,
          updatedAt: now,
        },
      });
    const [record] = await input.db
      .select({ count: newsletterRateLimits.count })
      .from(newsletterRateLimits)
      .where(eq(newsletterRateLimits.id, id))
      .limit(1);
    if (!record) throw new Error("rate-limit write was not observed");
    if (record.count > policy.maximum) {
      allowed = false;
      retryAfterSeconds = Math.max(
        retryAfterSeconds,
        Math.ceil((expiresAt.getTime() - now.getTime()) / 1_000),
      );
    }
  }
  return { allowed, retryAfterSeconds };
}
