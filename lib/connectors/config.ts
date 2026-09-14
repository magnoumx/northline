import { ConnectorError } from "./types";

export type ConnectorEnvironment = Record<string, string | undefined>;

export interface ConnectorRuntimeConfiguration {
  readonly enabled: boolean;
  readonly globalKill: boolean;
  readonly gdeltEnabled: boolean;
  readonly googleTrendsEnabled: boolean;
  readonly rssEnabled: boolean;
  readonly searchEnabled: boolean;
  readonly timeoutMs: number;
  readonly retryAttempts: number;
  readonly circuitFailureThreshold: number;
  readonly circuitCooldownMs: number;
}

export function resolveConnectorRuntimeConfiguration(
  environment: ConnectorEnvironment = process.env,
): ConnectorRuntimeConfiguration {
  return {
    enabled: environment.CONNECTORS_ENABLED === "true",
    globalKill: environment.CONNECTORS_GLOBAL_KILL !== "false",
    gdeltEnabled: environment.TREND_GDELT_ENABLED === "true",
    googleTrendsEnabled: environment.TREND_GOOGLE_ENABLED === "true",
    rssEnabled: environment.TREND_RSS_ENABLED === "true",
    searchEnabled: environment.SEARCH_CONNECTOR_ENABLED === "true",
    timeoutMs: boundedInteger(
      environment.CONNECTOR_TIMEOUT_MS,
      8_000,
      1_000,
      60_000,
      "CONNECTOR_TIMEOUT_MS",
    ),
    retryAttempts: boundedInteger(
      environment.CONNECTOR_RETRY_ATTEMPTS,
      2,
      1,
      4,
      "CONNECTOR_RETRY_ATTEMPTS",
    ),
    circuitFailureThreshold: boundedInteger(
      environment.CONNECTOR_CIRCUIT_FAILURE_THRESHOLD,
      3,
      1,
      20,
      "CONNECTOR_CIRCUIT_FAILURE_THRESHOLD",
    ),
    circuitCooldownMs: boundedInteger(
      environment.CONNECTOR_CIRCUIT_COOLDOWN_MS,
      30_000,
      1_000,
      900_000,
      "CONNECTOR_CIRCUIT_COOLDOWN_MS",
    ),
  };
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  key: string,
): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new ConnectorError(
      "CONNECTOR_CONFIGURATION_INVALID",
      `${key} must be an integer from ${minimum} through ${maximum}.`,
    );
  }
  return parsed;
}
