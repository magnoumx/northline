export type ConnectorKind = "trend" | "rss" | "search";

export interface ConnectorContext {
  readonly signal: AbortSignal;
}

export interface Connector<TInput, TItem> {
  readonly id: string;
  readonly kind: ConnectorKind;
  execute(
    input: TInput,
    context: ConnectorContext,
  ): Promise<readonly TItem[]>;
}

export interface TrendQuery {
  readonly query: string;
  readonly limit?: number;
  readonly since?: Date;
}

export interface TrendSignal {
  readonly externalId: string;
  readonly connectorId: string;
  readonly title: string;
  readonly url: string;
  readonly source: string;
  readonly observedAt: string;
  readonly score: number;
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
}

export interface SearchQuery {
  readonly query: string;
  readonly limit?: number;
  readonly publishedAfter?: Date;
}

export interface SearchResult {
  readonly externalId: string;
  readonly connectorId: string;
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
  readonly source: string;
  readonly publishedAt?: string;
}

export interface ConnectorHealth {
  readonly state: "closed" | "open" | "half_open";
  readonly consecutiveFailures: number;
  readonly lastSuccessAt?: string;
  readonly lastFailureAt?: string;
  readonly retryAt?: string;
}

export interface ConnectorRegistration {
  readonly connectorId: string;
  readonly provider: string;
  readonly status: "DISABLED" | "READY" | "MISCONFIGURED";
  readonly credentialsStatus: "NOT_REQUIRED" | "MISSING" | "CONFIGURED";
  readonly termsAndAttributionNotes: string;
  readonly rateLimits: string;
  readonly markets: readonly string[];
  readonly categories: readonly string[];
  readonly lastSuccessfulSync: string | null;
  readonly lastFailedSync: string | null;
  readonly failureCount: number;
  readonly circuitBreakerState: "closed" | "open" | "half_open" | "unknown";
  readonly estimatedCost: string;
}

export type ConnectorRunResult<TItem> =
  | {
      readonly ok: true;
      readonly connectorId: string;
      readonly items: readonly TItem[];
      readonly health: ConnectorHealth;
    }
  | {
      readonly ok: false;
      readonly connectorId: string;
      readonly code: ConnectorErrorCode;
      readonly errorMessage: string;
      readonly health: ConnectorHealth;
    };

export type ConnectorErrorCode =
  | "CONNECTOR_DISABLED"
  | "CONNECTOR_KILL_SWITCH_ACTIVE"
  | "CONNECTOR_CONFIGURATION_INVALID"
  | "CONNECTOR_CIRCUIT_OPEN"
  | "CONNECTOR_TIMEOUT"
  | "CONNECTOR_RATE_LIMITED"
  | "CONNECTOR_UNAVAILABLE"
  | "CONNECTOR_RESPONSE_INVALID"
  | "CONNECTOR_INPUT_INVALID";

export class ConnectorError extends Error {
  constructor(
    readonly code: ConnectorErrorCode,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ConnectorError";
  }
}

export type ConnectorRuntimeEvent =
  | {
      readonly type: "connector_started";
      readonly connectorId: string;
      readonly kind: ConnectorKind;
    }
  | {
      readonly type: "connector_succeeded";
      readonly connectorId: string;
      readonly itemCount: number;
      readonly durationMs: number;
    }
  | {
      readonly type: "connector_failed";
      readonly connectorId: string;
      readonly code: ConnectorErrorCode;
      readonly errorMessage: string;
      readonly durationMs: number;
    };

export type ConnectorRuntimeLogger = (event: ConnectorRuntimeEvent) => void;
