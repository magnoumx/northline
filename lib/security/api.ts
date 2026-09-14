import { sha256Base64Url } from "./crypto";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "UNAVAILABLE";

export function apiErrorResponse(
  code: ApiErrorCode,
  {
    status,
    message,
    requestId = crypto.randomUUID(),
    headers,
  }: {
    status: number;
    message: string;
    requestId?: string;
    headers?: HeadersInit;
  },
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("cache-control", "no-store");
  responseHeaders.set("content-type", "application/json; charset=utf-8");
  responseHeaders.set("x-request-id", requestId);
  return new Response(
    JSON.stringify({
      error: {
        code,
        message,
        requestId,
      },
    }),
    { status, headers: responseHeaders },
  );
}

export function validateIdempotencyKey(
  value: string | null,
): { valid: true; value: string } | { valid: false } {
  const normalized = value?.trim();
  return normalized &&
    normalized.length >= 16 &&
    normalized.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]+$/.test(normalized)
    ? { valid: true, value: normalized }
    : { valid: false };
}

export interface ReplayStore {
  /**
   * Atomically returns true only for the first claim of this digest before the
   * expiry time. A production implementation belongs in durable storage.
   */
  claimOnce(digest: string, expiresAt: Date): Promise<boolean>;
}

export async function claimReplayProtectedValue({
  scope,
  value,
  expiresAt,
  store,
}: {
  scope: string;
  value: string;
  expiresAt: Date;
  store: ReplayStore;
}): Promise<boolean> {
  if (
    !/^[a-z][a-z0-9:_-]{1,63}$/.test(scope) ||
    value.length < 8 ||
    value.length > 4_096 ||
    !Number.isFinite(expiresAt.getTime()) ||
    expiresAt.getTime() <= Date.now()
  ) {
    return false;
  }
  const digest = await sha256Base64Url(`${scope}\0${value}`);
  return store.claimOnce(digest, expiresAt);
}

export async function withDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  milliseconds: number,
): Promise<T> {
  if (
    !Number.isSafeInteger(milliseconds) ||
    milliseconds < 50 ||
    milliseconds > 60_000
  ) {
    throw new RangeError("Deadline must be between 50 and 60000 milliseconds.");
  }
  return operation(AbortSignal.timeout(milliseconds));
}
