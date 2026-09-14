import { runtimeFetch } from "../runtime/fetch";
import { z } from "zod";
import { validateExternalHttpUrl } from "../security/url";
import { externalIdentifier } from "./identifiers";
import {
  ConnectorError,
  type Connector,
  type TrendQuery,
  type TrendSignal,
} from "./types";

const GDELT_ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc";
const MAX_QUERY_CHARACTERS = 500;

const gdeltResponse = z.object({
  articles: z
    .array(
      z.object({
        title: z.string().min(1).max(1_000),
        url: z.string().max(2_048),
        domain: z.string().max(253).optional(),
        seendate: z.string().max(64).optional(),
        language: z.string().max(64).optional(),
      }),
    )
    .max(250)
    .default([]),
});

export class GdeltTrendConnector
  implements Connector<TrendQuery, TrendSignal>
{
  readonly id = "gdelt-doc";
  readonly kind = "trend" as const;

  constructor(private readonly fetchImpl: typeof fetch = runtimeFetch) {}

  async execute(
    input: TrendQuery,
    context: { signal: AbortSignal },
  ): Promise<readonly TrendSignal[]> {
    const query = input.query.trim();
    if (!query || query.length > MAX_QUERY_CHARACTERS) {
      throw new ConnectorError(
        "CONNECTOR_INPUT_INVALID",
        "The GDELT query is empty or oversized.",
      );
    }
    const limit = Math.min(250, Math.max(1, input.limit ?? 50));
    const url = new URL(GDELT_ENDPOINT);
    url.searchParams.set("query", query);
    url.searchParams.set("mode", "artlist");
    url.searchParams.set("format", "json");
    url.searchParams.set("sort", "datedesc");
    url.searchParams.set("maxrecords", String(limit));
    if (input.since) {
      url.searchParams.set(
        "startdatetime",
        input.since.toISOString().replace(/\D/gu, "").slice(0, 14),
      );
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
        redirect: "manual",
        signal: context.signal,
      });
    } catch (error) {
      if (context.signal.aborted) {
        throw new ConnectorError(
          "CONNECTOR_TIMEOUT",
          "The GDELT request timed out.",
          true,
        );
      }
      throw new ConnectorError(
        "CONNECTOR_UNAVAILABLE",
        `GDELT fetch failed: ${runtimeErrorMessage(error)}`,
        true,
      );
    }
    if (response.status === 429) {
      throw new ConnectorError(
        "CONNECTOR_RATE_LIMITED",
        "GDELT rate-limited the request.",
        true,
      );
    }
    if (!response.ok) {
      throw new ConnectorError(
        "CONNECTOR_UNAVAILABLE",
        `GDELT returned HTTP ${response.status}${response.headers.get("cf-ray") ? ` (cf-ray ${response.headers.get("cf-ray")})` : ""}.`,
        response.status >= 500,
      );
    }

    let parsed: z.output<typeof gdeltResponse>;
    try {
      parsed = gdeltResponse.parse(await response.json());
    } catch {
      throw new ConnectorError(
        "CONNECTOR_RESPONSE_INVALID",
        "GDELT returned an invalid response.",
      );
    }

    const signals = await Promise.all(
      parsed.articles
        .slice(0, limit)
        .map(async (article, index): Promise<TrendSignal | undefined> => {
        const validated = validateExternalHttpUrl(article.url);
        if (!validated.valid) return undefined;
        return {
          externalId: await externalIdentifier("gdelt", validated.url.href),
          connectorId: this.id,
          title: article.title.trim(),
          url: validated.url.href,
          source: article.domain?.trim() || validated.url.hostname,
          observedAt: normalizeGdeltDate(article.seendate),
          score: Math.max(1, Math.round(100 - (index / limit) * 50)),
          metadata: {
            rank: index + 1,
            ...(article.language ? { language: article.language } : {}),
          },
        } satisfies TrendSignal;
        }),
    );
    return signals.filter(
      (signal): signal is TrendSignal => signal !== undefined,
    );
  }
}

function runtimeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`.slice(0, 400);
  }
  return String(error).slice(0, 400);
}

function normalizeGdeltDate(value: string | undefined): string {
  if (value && /^\d{8}T\d{6}Z$/u.test(value)) {
    const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`;
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
}
