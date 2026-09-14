import { runtimeFetch } from "../runtime/fetch";
import { validateExternalHttpUrl } from "../security/url";
import { externalIdentifier } from "./identifiers";
import {
  ConnectorError,
  type Connector,
  type TrendSignal,
} from "./types";

const DEFAULT_GOOGLE_TRENDS_RSS =
  "https://trends.google.com/trending/rss?geo=US";
const MAX_RESPONSE_BYTES = 2_000_000;
const UNSAFE_XML_DECLARATION = /<!\s*(?:DOCTYPE|ENTITY)\b/iu;

export interface GoogleTrendsQuery {
  readonly limit?: number;
}

/**
 * Reads Google's official Trending Now RSS export for the United States.
 * The endpoint is pinned to trends.google.com and cannot be redirected to an
 * arbitrary host. Only trend metadata and source links are stored.
 */
export class GoogleTrendsConnector
  implements Connector<GoogleTrendsQuery, TrendSignal>
{
  readonly id = "google-trends-us";
  readonly kind = "trend" as const;
  private readonly endpoint: string;

  constructor(
    endpoint = DEFAULT_GOOGLE_TRENDS_RSS,
    private readonly fetchImpl: typeof fetch = runtimeFetch,
  ) {
    this.endpoint = validatedGoogleTrendsEndpoint(endpoint);
  }

  async execute(
    input: GoogleTrendsQuery,
    context: { signal: AbortSignal },
  ): Promise<readonly TrendSignal[]> {
    const limit = Math.min(100, Math.max(1, input.limit ?? 50));
    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "GET",
        headers: {
          accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8",
        },
        cache: "no-store",
        redirect: "manual",
        signal: context.signal,
      });
    } catch (error) {
      if (context.signal.aborted) {
        throw new ConnectorError(
          "CONNECTOR_TIMEOUT",
          "Google Trends timed out.",
          true,
        );
      }
      throw new ConnectorError(
        "CONNECTOR_UNAVAILABLE",
        `Google Trends fetch failed: ${runtimeErrorMessage(error)}`,
        true,
      );
    }

    if (response.status >= 300 && response.status < 400) {
      throw new ConnectorError(
        "CONNECTOR_RESPONSE_INVALID",
        "Google Trends returned an unexpected redirect.",
      );
    }
    if (response.status === 429) {
      throw new ConnectorError(
        "CONNECTOR_RATE_LIMITED",
        "Google Trends rate-limited the request.",
        true,
      );
    }
    if (!response.ok) {
      throw new ConnectorError(
        "CONNECTOR_UNAVAILABLE",
        `Google Trends returned HTTP ${response.status}${response.headers.get("cf-ray") ? ` (cf-ray ${response.headers.get("cf-ray")})` : ""}.`,
        response.status >= 500,
      );
    }

    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
      throw new ConnectorError(
        "CONNECTOR_RESPONSE_INVALID",
        "Google Trends returned an oversized response.",
      );
    }
    const xml = await response.text();
    if (
      !xml ||
      xml.length > MAX_RESPONSE_BYTES ||
      UNSAFE_XML_DECLARATION.test(xml)
    ) {
      throw new ConnectorError(
        "CONNECTOR_RESPONSE_INVALID",
        "Google Trends returned an empty, oversized, or unsafe feed.",
      );
    }

    const entries = parseGoogleTrendsRss(xml).slice(0, limit);
    const signals = await Promise.all(
      entries.map(async (entry, index): Promise<TrendSignal | undefined> => {
        const candidateUrl = entry.newsUrl || entry.link;
        const validated = validateExternalHttpUrl(candidateUrl);
        if (!validated.valid) return undefined;
        const relativeScore = trafficScore(entry.approxTraffic, index, limit);
        return {
          externalId: await externalIdentifier(
            "google-trends",
            `${entry.title}:${entry.publishedAt}:${validated.url.href}`,
          ),
          connectorId: this.id,
          title: entry.title,
          url: validated.url.href,
          source: entry.newsSource || "Google Trends",
          observedAt: normalizeDate(entry.publishedAt),
          score: relativeScore,
          metadata: {
            rank: index + 1,
            approximateTraffic: entry.approxTraffic,
            trafficLabel: entry.trafficLabel || "unknown",
            googleTrend: true,
          },
        } satisfies TrendSignal;
      }),
    );
    return signals.filter(
      (signal): signal is TrendSignal => signal !== undefined,
    );
  }
}

interface GoogleTrendEntry {
  title: string;
  link: string;
  publishedAt: string;
  approxTraffic: number;
  trafficLabel: string;
  newsUrl: string;
  newsSource: string;
}

export function parseGoogleTrendsRss(xml: string): readonly GoogleTrendEntry[] {
  if (!xml || xml.length > MAX_RESPONSE_BYTES || UNSAFE_XML_DECLARATION.test(xml)) {
    throw new ConnectorError(
      "CONNECTOR_RESPONSE_INVALID",
      "The Google Trends feed is empty, oversized, or unsafe.",
    );
  }
  return Array.from(
    xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/giu),
    (match) => match[1] ?? "",
  )
    .slice(0, 250)
    .map((block) => {
      const trafficLabel = cleanText(tagValue(block, "ht:approx_traffic"));
      return {
        title: cleanText(tagValue(block, "title")),
        link: cleanText(tagValue(block, "link")),
        publishedAt: cleanText(tagValue(block, "pubDate")),
        approxTraffic: parseTraffic(trafficLabel),
        trafficLabel,
        newsUrl: cleanText(tagValue(block, "ht:news_item_url")),
        newsSource: cleanText(tagValue(block, "ht:news_item_source")),
      };
    })
    .filter((entry) => entry.title && (entry.newsUrl || entry.link));
}

function validatedGoogleTrendsEndpoint(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConnectorError(
      "CONNECTOR_CONFIGURATION_INVALID",
      "GOOGLE_TRENDS_RSS_URL must be an absolute URL.",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "trends.google.com" ||
    !url.pathname.startsWith("/trending/rss")
  ) {
    throw new ConnectorError(
      "CONNECTOR_CONFIGURATION_INVALID",
      "Google Trends RSS must use the official trends.google.com export endpoint.",
    );
  }
  url.hash = "";
  if (!url.searchParams.get("geo")) url.searchParams.set("geo", "US");
  return url.toString();
}

function tagValue(block: string, tag: string): string {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = block.match(
    new RegExp(
      `<${escapedTag}\\b[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${escapedTag}>`,
      "iu",
    ),
  );
  return match?.[1] ?? "";
}

function cleanText(value: string): string {
  return decodeXmlEntities(value.replace(/<[^>]+>/gu, " "))
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 1_000);
}

function decodeXmlEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function runtimeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`.slice(0, 400);
  }
  return String(error).slice(0, 400);
}

function parseTraffic(value: string): number {
  const normalized = value.replaceAll(",", "").trim().toUpperCase();
  const match = normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*([KMB])?/u);
  if (!match) return 0;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return 0;
  const multiplier =
    match[2] === "B" ? 1_000_000_000 : match[2] === "M" ? 1_000_000 : match[2] === "K" ? 1_000 : 1;
  return Math.round(base * multiplier);
}

function trafficScore(traffic: number, index: number, limit: number): number {
  const volume = traffic > 0 ? Math.min(100, 35 + Math.log10(traffic) * 13) : 50;
  const rank = Math.max(20, 100 - (index / Math.max(1, limit)) * 45);
  return Math.max(1, Math.min(100, Math.round(volume * 0.65 + rank * 0.35)));
}

function normalizeDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? new Date().toISOString()
    : parsed.toISOString();
}
