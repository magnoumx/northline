import type { ConnectorRuntimeConfiguration } from "./config";
import {
  ConnectorError,
  type Connector,
  type ConnectorHealth,
  type ConnectorRunResult,
  type ConnectorRuntimeLogger,
} from "./types";

interface ConnectorCircuitState {
  failures: number;
  openedAt?: number;
  probeActive: boolean;
  lastSuccessAt?: number;
  lastFailureAt?: number;
}

export interface ConnectorRunnerDependencies {
  readonly clock?: () => number;
  readonly sleeper?: (milliseconds: number) => Promise<void>;
  readonly logger?: ConnectorRuntimeLogger;
}

export class ConnectorRunner {
  private readonly states = new Map<string, ConnectorCircuitState>();
  private readonly clock;
  private readonly sleeper;
  private readonly logger;

  constructor(
    private readonly configuration: ConnectorRuntimeConfiguration,
    dependencies: ConnectorRunnerDependencies = {},
  ) {
    this.clock = dependencies.clock ?? Date.now;
    this.sleeper =
      dependencies.sleeper ??
      ((milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.logger = dependencies.logger ?? (() => undefined);
  }

  async run<TInput, TItem>(
    connector: Connector<TInput, TItem>,
    input: TInput,
    callerSignal?: AbortSignal,
  ): Promise<ConnectorRunResult<TItem>> {
    const state = this.stateFor(connector.id);
    const gateError = this.gateError(state);
    if (gateError) {
      return {
        ok: false,
        connectorId: connector.id,
        code: gateError.code,
        errorMessage: gateError.message,
        health: this.health(connector.id),
      };
    }

    const startedAt = this.clock();
    this.logger({
      type: "connector_started",
      connectorId: connector.id,
      kind: connector.kind,
    });
    let lastError = new ConnectorError(
      "CONNECTOR_UNAVAILABLE",
      "The connector failed.",
      true,
    );

    for (
      let attempt = 1;
      attempt <= this.configuration.retryAttempts;
      attempt += 1
    ) {
      try {
        const timeoutSignal = AbortSignal.timeout(this.configuration.timeoutMs);
        const signal = callerSignal
          ? AbortSignal.any([callerSignal, timeoutSignal])
          : timeoutSignal;
        const items = await connector.execute(input, { signal });
        state.failures = 0;
        state.openedAt = undefined;
        state.probeActive = false;
        state.lastSuccessAt = this.clock();
        this.logger({
          type: "connector_succeeded",
          connectorId: connector.id,
          itemCount: items.length,
          durationMs: this.clock() - startedAt,
        });
        return {
          ok: true,
          connectorId: connector.id,
          items,
          health: this.health(connector.id),
        };
      } catch (error) {
        lastError = safeConnectorError(error);
        if (
          !lastError.retryable ||
          attempt === this.configuration.retryAttempts
        ) {
          break;
        }
        await this.sleeper(Math.min(2_000, 125 * 2 ** (attempt - 1)));
      }
    }

    state.probeActive = false;
    state.failures += 1;
    state.lastFailureAt = this.clock();
    if (state.failures >= this.configuration.circuitFailureThreshold) {
      state.openedAt = this.clock();
    }
    this.logger({
      type: "connector_failed",
      connectorId: connector.id,
      code: lastError.code,
      errorMessage: lastError.message,
      durationMs: this.clock() - startedAt,
    });
    return {
      ok: false,
      connectorId: connector.id,
      code: lastError.code,
      errorMessage: lastError.message,
      health: this.health(connector.id),
    };
  }

  health(connectorId: string): ConnectorHealth {
    const state = this.stateFor(connectorId);
    const retryAt =
      state.openedAt === undefined
        ? undefined
        : state.openedAt + this.configuration.circuitCooldownMs;
    return {
      state:
        retryAt === undefined
          ? "closed"
          : this.clock() >= retryAt
            ? "half_open"
            : "open",
      consecutiveFailures: state.failures,
      lastSuccessAt: isoDate(state.lastSuccessAt),
      lastFailureAt: isoDate(state.lastFailureAt),
      retryAt: isoDate(retryAt),
    };
  }

  private gateError(state: ConnectorCircuitState): ConnectorError | undefined {
    if (!this.configuration.enabled) {
      return new ConnectorError(
        "CONNECTOR_DISABLED",
        "The connector runtime is disabled.",
      );
    }
    if (this.configuration.globalKill) {
      return new ConnectorError(
        "CONNECTOR_KILL_SWITCH_ACTIVE",
        "The connector runtime kill switch is active.",
      );
    }
    if (state.openedAt === undefined) return undefined;
    if (
      this.clock() - state.openedAt <
      this.configuration.circuitCooldownMs
    ) {
      return new ConnectorError(
        "CONNECTOR_CIRCUIT_OPEN",
        "The connector circuit is temporarily open.",
        true,
      );
    }
    if (state.probeActive) {
      return new ConnectorError(
        "CONNECTOR_CIRCUIT_OPEN",
        "A connector recovery probe is already running.",
        true,
      );
    }
    state.probeActive = true;
    return undefined;
  }

  private stateFor(connectorId: string): ConnectorCircuitState {
    const current = this.states.get(connectorId);
    if (current) return current;
    const created = { failures: 0, probeActive: false };
    this.states.set(connectorId, created);
    return created;
  }
}

function safeConnectorError(error: unknown): ConnectorError {
  if (error instanceof ConnectorError) return error;
  if (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  ) {
    return new ConnectorError(
      "CONNECTOR_TIMEOUT",
      "The connector timed out.",
      true,
    );
  }
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : `Unknown connector failure: ${String(error)}`;
  return new ConnectorError(
    "CONNECTOR_UNAVAILABLE",
    message.slice(0, 500),
    true,
  );
}

function isoDate(value: number | undefined): string | undefined {
  return value === undefined ? undefined : new Date(value).toISOString();
}
