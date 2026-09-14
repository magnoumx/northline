import type { ConnectorRegistration } from "./types";

export type ConnectorRegistryEnvironment = Record<string, string | undefined>;

export function configuredConnectorRegistry(
  environment: ConnectorRegistryEnvironment =
    process.env as ConnectorRegistryEnvironment,
): readonly ConnectorRegistration[] {
  const globallyOperational =
    environment.CONNECTORS_ENABLED === "true" &&
    environment.CONNECTORS_GLOBAL_KILL === "false";
  return [
    registration({
      connectorId: "google-trends-us",
      provider: "Google Trends Trending Now RSS",
      enabled:
        globallyOperational && environment.TREND_GOOGLE_ENABLED === "true",
      configured: true,
      credentialsStatus: "NOT_REQUIRED",
      terms:
        "Official Trending Now RSS export for U.S. discovery; attribute Google Trends when reused and never automate Google Search result queries.",
      rateLimits: "15-minute scheduled fetch, bounded response size, retry, and circuit limits.",
      markets: ["US"],
      categories: ["trending searches", "news clusters"],
      cost: "Provider access fee: none; Worker egress applies.",
    }),
    registration({
      connectorId: "gdelt-doc-api",
      provider: "GDELT",
      enabled:
        globallyOperational && environment.TREND_GDELT_ENABLED === "true",
      configured: true,
      credentialsStatus: "NOT_REQUIRED",
      terms:
        "Public GDELT document API; preserve source URLs and publisher attribution.",
      rateLimits: "Application-enforced bounded queries and connector backoff.",
      markets: ["US"],
      categories: ["general", "business", "technology", "science"],
      cost: "Provider access fee: none; egress and Worker costs apply.",
    }),
    registration({
      connectorId: "approved-rss",
      provider: "Publisher and official RSS feeds",
      enabled:
        globallyOperational && environment.TREND_RSS_ENABLED === "true",
      configured: Boolean(environment.RSS_FEED_ALLOWLIST?.trim()),
      credentialsStatus: "NOT_REQUIRED",
      terms:
        "Only owner-approved publisher, government, company, and official announcement feeds; honor each feed's terms and attribution.",
      rateLimits: "Per-feed conditional fetch, bounded bytes, and backoff.",
      markets: ["US"],
      categories: ["configured per feed"],
      cost: "No assumed provider fee; egress and licensing may apply.",
    }),
    registration({
      connectorId: "licensed-search",
      provider: environment.SEARCH_PROVIDER?.trim() || "Unconfigured search",
      enabled:
        globallyOperational &&
        environment.SEARCH_CONNECTOR_ENABLED === "true",
      configured: Boolean(
        environment.SEARCH_ENDPOINT?.trim() &&
          environment.SEARCH_API_KEY?.trim(),
      ),
      credentialsStatus: environment.SEARCH_API_KEY?.trim()
        ? "CONFIGURED"
        : "MISSING",
      terms:
        "Use only a contracted search API; results are candidates and never model instructions.",
      rateLimits: "Provider contract plus application timeout, retry, and circuit limits.",
      markets: ["US"],
      categories: ["configured by provider"],
      cost: "Unknown until an approved provider contract is entered.",
    }),
  ];
}

function registration(input: {
  connectorId: string;
  provider: string;
  enabled: boolean;
  configured: boolean;
  credentialsStatus: ConnectorRegistration["credentialsStatus"];
  terms: string;
  rateLimits: string;
  markets: string[];
  categories: string[];
  cost: string;
}): ConnectorRegistration {
  return {
    connectorId: input.connectorId,
    provider: input.provider,
    status: !input.enabled
      ? "DISABLED"
      : input.configured
        ? "READY"
        : "MISCONFIGURED",
    credentialsStatus: input.credentialsStatus,
    termsAndAttributionNotes: input.terms,
    rateLimits: input.rateLimits,
    markets: input.markets,
    categories: input.categories,
    lastSuccessfulSync: null,
    lastFailedSync: null,
    failureCount: 0,
    circuitBreakerState: "unknown",
    estimatedCost: input.cost,
  };
}
