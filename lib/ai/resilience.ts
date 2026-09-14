import { AiRuntimeError, toSafeAiError } from "./errors";
import type { AiProviderHealth } from "./types";

export type Clock = () => number;
export type Sleeper = (milliseconds: number) => Promise<void>;

export class CircuitBreaker {
  private consecutiveFailures = 0;
  private openedAt: number | undefined;
  private halfOpenProbeActive = false;

  constructor(
    private readonly failureThreshold: number,
    private readonly cooldownMs: number,
    private readonly clock: Clock = Date.now,
  ) {}

  assertRequestAllowed(): void {
    if (this.openedAt === undefined) return;
    if (this.clock() - this.openedAt < this.cooldownMs) {
      throw new AiRuntimeError(
        "AI_CIRCUIT_OPEN",
        "The provider circuit is temporarily open.",
        true,
      );
    }
    if (this.halfOpenProbeActive) {
      throw new AiRuntimeError(
        "AI_CIRCUIT_OPEN",
        "A provider recovery probe is already running.",
        true,
      );
    }
    this.halfOpenProbeActive = true;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.openedAt = undefined;
    this.halfOpenProbeActive = false;
  }

  recordFailure(): void {
    this.halfOpenProbeActive = false;
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.openedAt = this.clock();
    }
  }

  snapshot(): AiProviderHealth {
    if (this.openedAt === undefined) {
      return {
        state: "closed",
        consecutiveFailures: this.consecutiveFailures,
      };
    }
    const retryAt = this.openedAt + this.cooldownMs;
    return {
      state: this.clock() >= retryAt ? "half_open" : "open",
      consecutiveFailures: this.consecutiveFailures,
      retryAt: new Date(retryAt).toISOString(),
    };
  }
}

export async function executeWithResilience<T>({
  operation,
  circuit,
  attempts,
  sleeper = defaultSleeper,
}: {
  operation: (attempt: number) => Promise<T>;
  circuit: CircuitBreaker;
  attempts: number;
  sleeper?: Sleeper;
}): Promise<T> {
  circuit.assertRequestAllowed();
  let lastError: AiRuntimeError | undefined;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await operation(attempt);
      circuit.recordSuccess();
      return result;
    } catch (error) {
      lastError = toSafeAiError(error);
      if (!lastError.retryable || attempt === attempts) break;
      await sleeper(Math.min(2_000, 125 * 2 ** (attempt - 1)));
    }
  }

  if (lastError?.retryable) {
    circuit.recordFailure();
  } else {
    // A reachable provider rejecting one request is not an outage signal.
    circuit.recordSuccess();
  }
  throw (
    lastError ??
    new AiRuntimeError(
      "AI_PROVIDER_UNAVAILABLE",
      "The provider operation failed.",
      true,
    )
  );
}

export function combineAbortSignals(
  timeoutMs: number,
  callerSignal?: AbortSignal,
): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return callerSignal
    ? AbortSignal.any([callerSignal, timeoutSignal])
    : timeoutSignal;
}

async function defaultSleeper(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
