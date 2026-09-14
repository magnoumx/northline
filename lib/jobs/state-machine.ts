export type DurableJobState =
  | "QUEUED"
  | "RUNNING"
  | "RETRY_WAIT"
  | "COMPLETED"
  | "DEAD_LETTER"
  | "CANCELLED";

export type DurableJobSnapshot = {
  id: string;
  state: DurableJobState;
  attemptCount: number;
  maximumAttempts: number;
  availableAt: Date;
  lockedBy: string | null;
  lockedUntil: Date | null;
  cancelledAt: Date | null;
};

export function calculateRetryAt({
  failedAt,
  attemptCount,
  baseDelayMs = 1_000,
  maximumDelayMs = 15 * 60_000,
  jitterFraction = 0,
}: {
  failedAt: Date;
  attemptCount: number;
  baseDelayMs?: number;
  maximumDelayMs?: number;
  jitterFraction?: number;
}): Date {
  if (
    !Number.isInteger(attemptCount) ||
    attemptCount < 1 ||
    !Number.isInteger(baseDelayMs) ||
    baseDelayMs < 100 ||
    !Number.isInteger(maximumDelayMs) ||
    maximumDelayMs < baseDelayMs ||
    !Number.isFinite(jitterFraction) ||
    jitterFraction < -0.25 ||
    jitterFraction > 0.25
  ) {
    throw new RangeError("Retry policy is outside bounded limits.");
  }
  const exponential = Math.min(
    maximumDelayMs,
    baseDelayMs * 2 ** Math.min(attemptCount - 1, 20),
  );
  return new Date(
    failedAt.getTime() + Math.round(exponential * (1 + jitterFraction)),
  );
}

export function failureDisposition(
  attemptCount: number,
  maximumAttempts: number,
): "RETRY_WAIT" | "DEAD_LETTER" {
  if (
    !Number.isInteger(attemptCount) ||
    !Number.isInteger(maximumAttempts) ||
    attemptCount < 1 ||
    maximumAttempts < 1 ||
    maximumAttempts > 20
  ) {
    throw new RangeError("Attempt counts are invalid.");
  }
  return attemptCount >= maximumAttempts ? "DEAD_LETTER" : "RETRY_WAIT";
}

export function canClaimJob(job: DurableJobSnapshot, now: Date): boolean {
  return (
    (job.state === "QUEUED" || job.state === "RETRY_WAIT") &&
    !job.cancelledAt &&
    job.availableAt.getTime() <= now.getTime() &&
    (!job.lockedUntil || job.lockedUntil.getTime() <= now.getTime())
  );
}

export function assertLeaseOwner(
  job: Pick<DurableJobSnapshot, "state" | "lockedBy" | "lockedUntil">,
  workerId: string,
  now: Date,
): void {
  if (
    job.state !== "RUNNING" ||
    job.lockedBy !== workerId ||
    !job.lockedUntil ||
    job.lockedUntil.getTime() <= now.getTime()
  ) {
    throw new JobStateError(
      "LEASE_LOST",
      "The job lease is missing, expired, or owned by another worker.",
    );
  }
}

export class JobStateError extends Error {
  constructor(
    readonly code:
      | "LEASE_LOST"
      | "IDEMPOTENCY_CONFLICT"
      | "NOT_FOUND"
      | "FEATURE_DISABLED"
      | "STATE_CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "JobStateError";
  }
}
