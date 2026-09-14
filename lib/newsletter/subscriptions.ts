import { and, eq } from "drizzle-orm";
import { getD1Binding, getDb } from "../../db";
import { newsletterSubscribers } from "../../db/schema";
import { isValidConfirmationToken, sha256 } from "./crypto";

export type ConfirmationResult =
  | "confirmed"
  | "already-confirmed"
  | "expired"
  | "invalid";

export type ConfirmationDisposition = ConfirmationResult | "confirmable";

type BatchRecord = {
  id: string;
  email: string;
  listsJson: string;
  status: string;
  confirmationTokenExpiresAt: number;
};

export function evaluateConfirmationRecord(
  subscriber:
    | {
        status: string;
        confirmationTokenExpiresAt: Date | null;
      }
    | undefined,
  now: Date,
): ConfirmationDisposition {
  if (!subscriber) return "invalid";
  if (subscriber.status === "confirmed") return "already-confirmed";
  if (
    !subscriber.confirmationTokenExpiresAt ||
    subscriber.confirmationTokenExpiresAt.getTime() <= now.getTime()
  ) {
    return "expired";
  }
  return subscriber.status === "pending" ? "confirmable" : "invalid";
}

export async function confirmNewsletterSubscription(
  token: string,
  now = new Date(),
): Promise<ConfirmationResult> {
  if (!isValidConfirmationToken(token)) return "invalid";
  const tokenHash = await sha256(token);

  const batchResult = await confirmBatch(tokenHash, now);
  if (batchResult !== "invalid") return batchResult;

  // Legacy single-list confirmations remain valid for subscriptions created
  // before the unified briefing picker was introduced.
  const db = await getDb();
  const [subscriber] = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.confirmationTokenHash, tokenHash))
    .limit(1);

  const disposition = evaluateConfirmationRecord(subscriber, now);
  if (disposition === "already-confirmed" || disposition === "invalid") {
    return disposition;
  }
  if (disposition === "expired") {
    await db
      .update(newsletterSubscribers)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(newsletterSubscribers.id, subscriber.id),
          eq(newsletterSubscribers.confirmationTokenHash, tokenHash),
        ),
      );
    return "expired";
  }

  const updated = await db
    .update(newsletterSubscribers)
    .set({ status: "confirmed", confirmedAt: now, updatedAt: now })
    .where(
      and(
        eq(newsletterSubscribers.id, subscriber.id),
        eq(newsletterSubscribers.confirmationTokenHash, tokenHash),
        eq(newsletterSubscribers.status, "pending"),
      ),
    )
    .returning({ id: newsletterSubscribers.id });

  if (updated.length > 0) return "confirmed";
  const [current] = await db
    .select({
      status: newsletterSubscribers.status,
      confirmationTokenExpiresAt:
        newsletterSubscribers.confirmationTokenExpiresAt,
    })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.confirmationTokenHash, tokenHash))
    .limit(1);
  const currentDisposition = evaluateConfirmationRecord(current, now);
  return currentDisposition === "already-confirmed"
    ? "already-confirmed"
    : "invalid";
}

export async function inspectNewsletterSubscription(
  token: string,
  now = new Date(),
): Promise<ConfirmationDisposition> {
  if (!isValidConfirmationToken(token)) return "invalid";
  const tokenHash = await sha256(token);
  const batch = await readBatch(tokenHash);
  if (batch) return evaluateBatch(batch, now);

  const db = await getDb();
  const [subscriber] = await db
    .select({
      status: newsletterSubscribers.status,
      confirmationTokenExpiresAt:
        newsletterSubscribers.confirmationTokenExpiresAt,
    })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.confirmationTokenHash, tokenHash))
    .limit(1);
  return evaluateConfirmationRecord(subscriber, now);
}

export function confirmationExpiry(
  now: Date,
  configuredHours: string | undefined,
): Date {
  const parsed = Number(configuredHours ?? "24");
  const hours =
    Number.isInteger(parsed) && parsed >= 1 && parsed <= 168 ? parsed : 24;
  return new Date(now.getTime() + hours * 60 * 60 * 1_000);
}

async function confirmBatch(
  tokenHash: string,
  now: Date,
): Promise<ConfirmationResult> {
  const batch = await readBatch(tokenHash);
  if (!batch) return "invalid";
  const disposition = evaluateBatch(batch, now);
  const database = await getD1Binding();
  if (disposition === "already-confirmed") return disposition;
  if (disposition === "expired") {
    await database
      .prepare(
        `UPDATE newsletter_signup_batches
         SET status='expired', updated_at=?1
         WHERE id=?2 AND confirmation_token_hash=?3`,
      )
      .bind(now.getTime(), batch.id, tokenHash)
      .run();
    return "expired";
  }
  if (disposition !== "confirmable") return "invalid";

  const lists = parseLists(batch.listsJson);
  if (!lists.length) return "invalid";
  const nowMs = now.getTime();
  const statements: D1PreparedStatement[] = [];
  for (const list of lists) {
    const perListHash = await sha256(`${tokenHash}:${list}`);
    statements.push(
      database
        .prepare(
          `INSERT INTO newsletter_subscribers (
             id, email, list, status, consent_source,
             confirmation_token_hash, confirmation_token_expires_at,
             consented_at, confirmed_at, unsubscribed_at,
             created_at, updated_at
           ) VALUES (?1, ?2, ?3, 'confirmed', 'northline_web_form', ?4, ?5, ?6, ?6, NULL, ?6, ?6)
           ON CONFLICT(email, list) DO UPDATE SET
             status='confirmed',
             confirmation_token_hash=excluded.confirmation_token_hash,
             confirmation_token_expires_at=excluded.confirmation_token_expires_at,
             consented_at=excluded.consented_at,
             confirmed_at=excluded.confirmed_at,
             unsubscribed_at=NULL,
             updated_at=excluded.updated_at`,
        )
        .bind(
          crypto.randomUUID(),
          batch.email,
          list,
          perListHash,
          batch.confirmationTokenExpiresAt,
          nowMs,
        ),
    );
  }
  statements.push(
    database
      .prepare(
        `UPDATE newsletter_signup_batches
         SET status='confirmed', confirmed_at=?1, updated_at=?1
         WHERE id=?2 AND status='pending' AND confirmation_token_hash=?3`,
      )
      .bind(nowMs, batch.id, tokenHash),
  );
  await database.batch(statements);
  return "confirmed";
}

async function readBatch(tokenHash: string): Promise<BatchRecord | null> {
  try {
    const database = await getD1Binding();
    return (
      (await database
        .prepare(
          `SELECT id, email, lists_json AS listsJson, status,
            confirmation_token_expires_at AS confirmationTokenExpiresAt
           FROM newsletter_signup_batches
           WHERE confirmation_token_hash=?1 LIMIT 1`,
        )
        .bind(tokenHash)
        .first<BatchRecord>()) ?? null
    );
  } catch {
    // The fallback keeps older databases usable until migration 0008 is applied.
    return null;
  }
}

function evaluateBatch(
  batch: BatchRecord,
  now: Date,
): ConfirmationDisposition {
  if (batch.status === "confirmed") return "already-confirmed";
  if (batch.confirmationTokenExpiresAt <= now.getTime()) return "expired";
  return batch.status === "pending" ? "confirmable" : "invalid";
}

function parseLists(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed
          .filter((item): item is string =>
            item === "daily-brief" ||
            item === "breaking-updates" ||
            item === "weekend-deep-reads",
          )
      : [];
  } catch {
    return [];
  }
}
