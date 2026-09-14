import type { ConnectorRuntimeConfiguration } from "./config";
import type { ConnectorKind } from "./types";

export function connectorKindEnabled(
  configuration: ConnectorRuntimeConfiguration,
  kind: ConnectorKind,
): boolean {
  if (!configuration.enabled || configuration.globalKill) return false;
  switch (kind) {
    case "trend":
      return configuration.gdeltEnabled || configuration.googleTrendsEnabled;
    case "rss":
      return configuration.rssEnabled;
    case "search":
      return configuration.searchEnabled;
  }
}
