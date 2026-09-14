import { NEWSROOM_SCHEDULES, type NewsroomScheduleKind } from "./schedules";

export type QueueMessageDisposition = "ACK" | "RETRY" | "DEAD_LETTER";

export type QueueJobMessage = {
  kind: string;
  scheduledTime?: string;
  source?: string;
  payload?: unknown;
};

export type JobServices = {
  featureFlags?: Record<string, unknown>;
  [key: string]: unknown;
};

export type JobHandlerResult =
  | { outcome: "DONE" }
  | { outcome: "SKIPPED"; reason: string };

export type JobHandler = (
  message: QueueJobMessage,
  services: JobServices,
) => Promise<JobHandlerResult>;

export type JobHandlerRegistry = Partial<Record<string, JobHandler>>;

export const SCHEDULE_KINDS: readonly NewsroomScheduleKind[] =
  NEWSROOM_SCHEDULES.map((entry) => entry.kind);

export function isKnownScheduleKind(
  kind: string,
): kind is NewsroomScheduleKind {
  return (SCHEDULE_KINDS as readonly string[]).includes(kind);
}

export function digestError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}:${error.message}`.slice(0, 200);
  }
  return String(error).slice(0, 200);
}

export async function dispatchQueueMessage(input: {
  message: unknown;
  registry: JobHandlerRegistry;
  services?: JobServices;
  attemptCount: number;
  maximumAttempts?: number;
}): Promise<{
  disposition: QueueMessageDisposition;
  reason?: string;
  errorDigest?: string;
}> {
  const message = input.message as QueueJobMessage;
  if (!message || typeof message !== "object" || typeof message.kind !== "string") {
    return {
      disposition: "DEAD_LETTER",
      reason: "malformed_message",
      errorDigest: "message_missing_kind",
    };
  }
  const handler = input.registry[message.kind];
  if (!isKnownScheduleKind(message.kind) && !handler) {
    return {
      disposition: "DEAD_LETTER",
      reason: "unknown_kind",
      errorDigest: `unknown_kind:${message.kind}`.slice(0, 200),
    };
  }
  if (!handler) {
    return { disposition: "ACK", reason: "no_handler_registered" };
  }
  try {
    const result = await handler(message, input.services ?? {});
    return {
      disposition: "ACK",
      reason: result.outcome === "SKIPPED" ? result.reason : "completed",
    };
  } catch (error) {
    const max = input.maximumAttempts ?? 5;
    if (input.attemptCount >= max) {
      return {
        disposition: "DEAD_LETTER",
        reason: "exhausted_retries",
        errorDigest: digestError(error),
      };
    }
    return {
      disposition: "RETRY",
      reason: "handler_error",
      errorDigest: digestError(error),
    };
  }
}
