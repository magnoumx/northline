import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { getDb } from "../../db";
import {
  durableJobs,
  jobDeadLetters,
} from "../../db/schema-v3-operations";
import { sha256Base64Url } from "../security/crypto";
import {
  calculateRetryAt,
  failureDisposition,
  JobStateError,
} from "./state-machine";

type NorthlineDb = Awaited<ReturnType<typeof getDb>>;
type JobRow = typeof durableJobs.$inferSelect;

export type DurableJobsEnvironment = {
  FEATURE_DURABLE_JOBS?: string;
};

export function createD1DurableJobRepository(
  db: NorthlineDb,
  environment: DurableJobsEnvironment =
    process.env as DurableJobsEnvironment,
) {
  const assertEnabled = () => {
    if (environment.FEATURE_DURABLE_JOBS !== "true") {
      throw new JobStateError(
        "FEATURE_DISABLED",
        "Durable jobs are disabled until queue infrastructure is approved.",
      );
    }
  };
  return {
    async enqueue(input: {
      queue: string;
      kind: string;
      idempotencyKey: string;
      payload: unknown;
      availableAt?: Date;
      priority?: number;
      maximumAttempts?: number;
    }): Promise<{ job: JobRow; replayed: boolean }> {
      assertEnabled();
      validateEnqueueInput(input);
      const payloadJson = JSON.stringify(input.payload);
      const [idempotencyKeyHash, payloadHash] = await Promise.all([
        sha256Base64Url(
          `${input.queue}\u0000${input.kind}\u0000${input.idempotencyKey}`,
        ),
        sha256Base64Url(payloadJson),
      ]);
      const [existing] = await db
        .select()
        .from(durableJobs)
        .where(eq(durableJobs.idempotencyKeyHash, idempotencyKeyHash))
        .limit(1);
      if (existing) {
        if (existing.payloadHash !== payloadHash) {
          throw new JobStateError(
            "IDEMPOTENCY_CONFLICT",
            "The job idempotency key was used with a different payload.",
          );
        }
        return { job: existing, replayed: true };
      }
      const now = new Date();
      const [job] = await db
        .insert(durableJobs)
        .values({
          id: `job_${crypto.randomUUID()}`,
          queue: input.queue,
          kind: input.kind,
          idempotencyKeyHash,
          state: "QUEUED",
          priority: input.priority ?? 100,
          payloadJson,
          payloadHash,
          attemptCount: 0,
          maximumAttempts: input.maximumAttempts ?? 5,
          availableAt: input.availableAt ?? now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return { job, replayed: false };
    },

    async claim(input: {
      queue: string;
      workerId: string;
      now?: Date;
      leaseSeconds?: number;
    }): Promise<JobRow | null> {
      assertEnabled();
      const now = input.now ?? new Date();
      const leaseSeconds = input.leaseSeconds ?? 120;
      validateWorker(input.queue, input.workerId, leaseSeconds);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const [candidate] = await db
          .select({ id: durableJobs.id })
          .from(durableJobs)
          .where(
            and(
              eq(durableJobs.queue, input.queue),
              inArray(durableJobs.state, ["QUEUED", "RETRY_WAIT"]),
              lte(durableJobs.availableAt, now),
              isNull(durableJobs.cancelledAt),
              or(
                isNull(durableJobs.lockedUntil),
                lte(durableJobs.lockedUntil, now),
              ),
            ),
          )
          .orderBy(asc(durableJobs.priority), asc(durableJobs.availableAt))
          .limit(1);
        if (!candidate) return null;
        const [claimed] = await db
          .update(durableJobs)
          .set({
            state: "RUNNING",
            attemptCount: sql`${durableJobs.attemptCount} + 1`,
            lockedBy: input.workerId,
            lockedUntil: new Date(now.getTime() + leaseSeconds * 1_000),
            timeoutAt: new Date(now.getTime() + leaseSeconds * 1_000),
            updatedAt: now,
          })
          .where(
            and(
              eq(durableJobs.id, candidate.id),
              inArray(durableJobs.state, ["QUEUED", "RETRY_WAIT"]),
              or(
                isNull(durableJobs.lockedUntil),
                lte(durableJobs.lockedUntil, now),
              ),
            ),
          )
          .returning();
        if (claimed) return claimed;
      }
      return null;
    },

    async complete(input: {
      jobId: string;
      workerId: string;
      now?: Date;
    }): Promise<JobRow> {
      assertEnabled();
      const now = input.now ?? new Date();
      const [completed] = await db
        .update(durableJobs)
        .set({
          state: "COMPLETED",
          completedAt: now,
          lockedBy: null,
          lockedUntil: null,
          timeoutAt: null,
          errorCategory: null,
          errorDigest: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(durableJobs.id, input.jobId),
            eq(durableJobs.state, "RUNNING"),
            eq(durableJobs.lockedBy, input.workerId),
            gt(durableJobs.lockedUntil, now),
          ),
        )
        .returning();
      if (!completed) {
        throw new JobStateError("LEASE_LOST", "The completion lease was lost.");
      }
      return completed;
    },

    async fail(input: {
      jobId: string;
      workerId: string;
      errorCategory: string;
      errorDigest: string;
      now?: Date;
    }): Promise<JobRow> {
      assertEnabled();
      const now = input.now ?? new Date();
      const [job] = await db
        .select()
        .from(durableJobs)
        .where(eq(durableJobs.id, input.jobId))
        .limit(1);
      if (!job) throw new JobStateError("NOT_FOUND", "Job not found.");
      if (
        job.state !== "RUNNING" ||
        job.lockedBy !== input.workerId ||
        !job.lockedUntil ||
        job.lockedUntil.getTime() <= now.getTime()
      ) {
        throw new JobStateError("LEASE_LOST", "The failure lease was lost.");
      }
      const disposition = failureDisposition(
        job.attemptCount,
        job.maximumAttempts,
      );
      const availableAt =
        disposition === "RETRY_WAIT"
          ? calculateRetryAt({
              failedAt: now,
              attemptCount: job.attemptCount,
            })
          : now;
      const update = db
        .update(durableJobs)
        .set({
          state: disposition,
          availableAt,
          lockedBy: null,
          lockedUntil: null,
          timeoutAt: null,
          errorCategory: input.errorCategory.slice(0, 80),
          errorDigest: input.errorDigest.slice(0, 256),
          updatedAt: now,
        })
        .where(
          and(
            eq(durableJobs.id, job.id),
            eq(durableJobs.state, "RUNNING"),
            eq(durableJobs.lockedBy, input.workerId),
          ),
        )
        .returning();
      if (disposition === "DEAD_LETTER") {
        const results = await db.batch([
          update,
          db.insert(jobDeadLetters).values({
            id: `dead_${crypto.randomUUID()}`,
            jobId: job.id,
            payloadHash: job.payloadHash,
            finalErrorCategory: input.errorCategory.slice(0, 80),
            finalErrorDigest: input.errorDigest.slice(0, 256),
            createdAt: now,
          }),
        ]);
        return results[0][0];
      }
      const [updated] = await update;
      return updated;
    },

    async cancel(jobId: string, now = new Date()): Promise<boolean> {
      assertEnabled();
      const rows = await db
        .update(durableJobs)
        .set({
          state: "CANCELLED",
          cancelledAt: now,
          lockedBy: null,
          lockedUntil: null,
          timeoutAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(durableJobs.id, jobId),
            inArray(durableJobs.state, ["QUEUED", "RETRY_WAIT"]),
          ),
        )
        .returning({ id: durableJobs.id });
      return rows.length === 1;
    },

    async replayDeadLetter(input: {
      deadLetterId: string;
      replayKey: string;
      now?: Date;
    }): Promise<JobRow> {
      assertEnabled();
      if (
        !/^[A-Za-z0-9:_-]{8,128}$/u.test(input.deadLetterId) ||
        !/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u.test(input.replayKey)
      ) {
        throw new TypeError("Dead-letter replay input is invalid.");
      }
      const [row] = await db
        .select({
          deadLetterId: jobDeadLetters.id,
          replayedAsJobId: jobDeadLetters.replayedAsJobId,
          job: durableJobs,
        })
        .from(jobDeadLetters)
        .innerJoin(durableJobs, eq(jobDeadLetters.jobId, durableJobs.id))
        .where(eq(jobDeadLetters.id, input.deadLetterId))
        .limit(1);
      if (!row) {
        throw new JobStateError("NOT_FOUND", "Dead letter not found.");
      }
      if (row.replayedAsJobId) {
        const [existing] = await db
          .select()
          .from(durableJobs)
          .where(eq(durableJobs.id, row.replayedAsJobId))
          .limit(1);
        if (existing) return existing;
        throw new JobStateError(
          "STATE_CONFLICT",
          "The dead letter references a missing replay job.",
        );
      }
      const now = input.now ?? new Date();
      const newJobId = `job_${crypto.randomUUID()}`;
      const idempotencyKeyHash = await sha256Base64Url(
        `replay\u0000${row.job.id}\u0000${input.replayKey}`,
      );
      const results = await db.batch([
        db
          .insert(durableJobs)
          .values({
            id: newJobId,
            queue: row.job.queue,
            kind: row.job.kind,
            idempotencyKeyHash,
            state: "QUEUED",
            priority: row.job.priority,
            payloadJson: row.job.payloadJson,
            payloadHash: row.job.payloadHash,
            attemptCount: 0,
            maximumAttempts: row.job.maximumAttempts,
            availableAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .returning(),
        db
          .update(jobDeadLetters)
          .set({ replayedAsJobId: newJobId })
          .where(
            and(
              eq(jobDeadLetters.id, row.deadLetterId),
              isNull(jobDeadLetters.replayedAsJobId),
            ),
          ),
      ]);
      return results[0][0];
    },
  };
}

function validateEnqueueInput(input: {
  queue: string;
  kind: string;
  idempotencyKey: string;
  priority?: number;
  maximumAttempts?: number;
}): void {
  if (
    !/^[a-z][a-z0-9_-]{1,63}$/u.test(input.queue) ||
    !/^[a-z][a-z0-9._:-]{1,127}$/u.test(input.kind) ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u.test(input.idempotencyKey) ||
    (input.priority !== undefined &&
      (!Number.isInteger(input.priority) ||
        input.priority < 0 ||
        input.priority > 1_000)) ||
    (input.maximumAttempts !== undefined &&
      (!Number.isInteger(input.maximumAttempts) ||
        input.maximumAttempts < 1 ||
        input.maximumAttempts > 20))
  ) {
    throw new TypeError("Durable job input is invalid.");
  }
}

function validateWorker(
  queue: string,
  workerId: string,
  leaseSeconds: number,
): void {
  if (
    !/^[a-z][a-z0-9_-]{1,63}$/u.test(queue) ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(workerId) ||
    !Number.isInteger(leaseSeconds) ||
    leaseSeconds < 15 ||
    leaseSeconds > 900
  ) {
    throw new TypeError("Worker lease input is invalid.");
  }
}
