import { validateExternalHttpUrl } from "../security/url";
import { externalIdentifier } from "./identifiers";
import {
  ConnectorError,
  type Connector,
  type SearchQuery,
  type SearchResult,
} from "./types";

export interface SearchTransportResult {
  readonly title: string;
  readonly url: string;
  readonly snippet?: string;
  readonly source?: string;
  readonly publishedAt?: string;
  readonly providerId?: string;
}

/**
 * Provider-specific credentials and endpoints stay behind this interface.
 * Implementations must enforce HTTPS, DNS/redirect safety, response-size limits,
 * and provider-specific request authentication without logging secrets.
 */
export interface SafeSearchTransport {
  search(input: {
    readonly query: string;
    readonly limit: number;
    readonly publishedAfter?: string;
    readonly signal: AbortSignal;
  }): Promise<readonly SearchTransportResult[]>;
}

export class SearchConnector
  implements Connector<SearchQuery, SearchResult>
{
  readonly kind = "search" as const;

  constructor(
    readonly id: string,
    private readonly transport: SafeSearchTransport,
  ) {
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/u.test(id)) {
      throw new ConnectorError(
        "CONNECTOR_CONFIGURATION_INVALID",
        "The search connector identifier is invalid.",
      );
    }
  }

  async execute(
    input: SearchQuery,
    context: { signal: AbortSignal },
  ): Promise<readonly SearchResult[]> {
    const query = input.query.trim();
    if (!query || query.length > 500) {
      throw new ConnectorError(
        "CONNECTOR_INPUT_INVALID",
        "The search query is empty or oversized.",
      );
    }
    const limit = Math.min(100, Math.max(1, input.limit ?? 20));
    let results: readonly SearchTransportResult[];
    try {
      results = await this.transport.search({
        query,
        limit,
        publishedAfter: input.publishedAfter?.toISOString(),
        signal: context.signal,
      });
    } catch (error) {
      if (error instanceof ConnectorError) throw error;
      if (context.signal.aborted) {
        throw new ConnectorError(
          "CONNECTOR_TIMEOUT",
          "The configured search transport timed out.",
          true,
        );
      }
      throw new ConnectorError(
        "CONNECTOR_UNAVAILABLE",
        "The configured search transport failed.",
        true,
      );
    }
    if (!Array.isArray(results) || results.length > 500) {
      throw new ConnectorError(
        "CONNECTOR_RESPONSE_INVALID",
        "The search transport returned an invalid result collection.",
      );
    }

    const normalized = await Promise.all(
      results
        .slice(0, limit)
        .map(async (result): Promise<SearchResult | undefined> => {
        const url = validateExternalHttpUrl(result.url);
        if (
          !url.valid ||
          !result.title?.trim() ||
          result.title.length > 1_000
        ) {
          return undefined;
        }
        return {
          externalId: await externalIdentifier(
            this.id,
            result.providerId
              ? `${result.providerId.slice(0, 256)}\u0000${url.url.href}`
              : url.url.href,
          ),
          connectorId: this.id,
          title: result.title.trim(),
          url: url.url.href,
          snippet: (result.snippet ?? "")
            .replace(/\s+/gu, " ")
            .trim()
            .slice(0, 4_000),
          source: result.source?.trim().slice(0, 253) || url.url.hostname,
          publishedAt: normalizeOptionalDate(result.publishedAt),
        } satisfies SearchResult;
        }),
    );
    return normalized.filter(
      (result): result is SearchResult => result !== undefined,
    );
  }
}

function normalizeOptionalDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed.toISOString();
}
