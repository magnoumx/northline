import { validateExternalHttpUrl } from "../security/url";
import { externalIdentifier } from "./identifiers";
import {
  ConnectorError,
  type Connector,
  type TrendSignal,
} from "./types";

const MAX_FEED_BYTES = 2_000_000;
const UNSAFE_XML_DECLARATION = /<!\s*(?:DOCTYPE|ENTITY)\b/iu;

export interface RssFeedConfiguration {
  readonly id: string;
  readonly url: string;
  readonly sourceName: string;
}

export interface RssQuery {
  readonly feedId: string;
  readonly limit?: number;
}

/**
 * Implementations must pin public DNS results while connecting, cap response
 * bytes, reject credentials/non-HTTP schemes, and revalidate every redirect.
 * The connector deliberately has no ambient `fetch` fallback.
 */
export interface SafeFeedTransport {
  fetchFeed(input: {
    readonly url: string;
    readonly maximumBytes: number;
    readonly signal: AbortSignal;
  }): Promise<{
    readonly body: string;
    readonly finalUrl: string;
    readonly contentType: string;
  }>;
}

export class RssTrendConnector implements Connector<RssQuery, TrendSignal> {
  readonly id;
  readonly kind = "rss" as const;
  private readonly feedUrl: string;

  constructor(
    private readonly configuration: RssFeedConfiguration,
    private readonly transport: SafeFeedTransport,
  ) {
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/u.test(configuration.id)) {
      throw new ConnectorError(
        "CONNECTOR_CONFIGURATION_INVALID",
        "The RSS feed identifier is invalid.",
      );
    }
    const validated = validateExternalHttpUrl(configuration.url);
    if (!validated.valid) {
      throw new ConnectorError(
        "CONNECTOR_CONFIGURATION_INVALID",
        "The RSS feed URL must be an absolute HTTPS URL.",
      );
    }
    this.id = `rss:${configuration.id}`;
    this.feedUrl = validated.url.href;
  }

  async execute(
    input: RssQuery,
    context: { signal: AbortSignal },
  ): Promise<readonly TrendSignal[]> {
    if (input.feedId !== this.configuration.id) {
      throw new ConnectorError(
        "CONNECTOR_INPUT_INVALID",
        "The requested RSS feed is not configured for this connector.",
      );
    }
    const limit = Math.min(100, Math.max(1, input.limit ?? 30));
    let response: Awaited<ReturnType<SafeFeedTransport["fetchFeed"]>>;
    try {
      response = await this.transport.fetchFeed({
        url: this.feedUrl,
        maximumBytes: MAX_FEED_BYTES,
        signal: context.signal,
      });
    } catch (error) {
      if (error instanceof ConnectorError) throw error;
      if (context.signal.aborted) {
        throw new ConnectorError(
          "CONNECTOR_TIMEOUT",
          "The configured RSS transport timed out.",
          true,
        );
      }
      throw new ConnectorError(
        "CONNECTOR_UNAVAILABLE",
        "The configured RSS transport failed.",
        true,
      );
    }
    if (
      response.body.length > MAX_FEED_BYTES ||
      UNSAFE_XML_DECLARATION.test(response.body)
    ) {
      throw new ConnectorError(
        "CONNECTOR_RESPONSE_INVALID",
        "The RSS response is oversized or contains a forbidden XML declaration.",
      );
    }
    const finalUrl = validateExternalHttpUrl(response.finalUrl);
    if (
      !finalUrl.valid ||
      (!response.contentType.toLowerCase().includes("xml") &&
        !response.contentType.toLowerCase().includes("rss") &&
        !response.contentType.toLowerCase().includes("atom"))
    ) {
      throw new ConnectorError(
        "CONNECTOR_RESPONSE_INVALID",
        "The RSS transport returned an invalid final URL or content type.",
      );
    }

    const entries = parseRssOrAtom(response.body).slice(0, limit);
    const signals = await Promise.all(
      entries.map(async (entry, index): Promise<TrendSignal | undefined> => {
        const validatedUrl = validateExternalHttpUrl(entry.url);
        if (!validatedUrl.valid) return undefined;
        return {
          externalId: await externalIdentifier(
            this.id,
            entry.guid || validatedUrl.url.href,
          ),
          connectorId: this.id,
          title: entry.title,
          url: validatedUrl.url.href,
          source: this.configuration.sourceName,
          observedAt: normalizeDate(entry.publishedAt),
          score: Math.max(1, Math.round(90 - (index / limit) * 40)),
          metadata: { rank: index + 1 },
        } satisfies TrendSignal;
      }),
    );
    return signals.filter(
      (signal): signal is TrendSignal => signal !== undefined,
    );
  }
}

interface ParsedFeedEntry {
  readonly title: string;
  readonly url: string;
  readonly guid: string;
  readonly publishedAt: string;
}

export function parseRssOrAtom(xml: string): readonly ParsedFeedEntry[] {
  if (!xml || xml.length > MAX_FEED_BYTES || UNSAFE_XML_DECLARATION.test(xml)) {
    throw new ConnectorError(
      "CONNECTOR_RESPONSE_INVALID",
      "The feed document is empty, oversized, or unsafe.",
    );
  }
  const itemBlocks =
    Array.from(xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/giu), (match) =>
      match[1] ?? "",
    ) ||
    [];
  const blocks =
    itemBlocks.length > 0
      ? itemBlocks
      : Array.from(
          xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/giu),
          (match) => match[1] ?? "",
        );
  return blocks
    .slice(0, 250)
    .map((block) => ({
      title: cleanText(tagValue(block, "title")),
      url:
        cleanText(tagValue(block, "link")) ||
        cleanText(attributeValue(block, "link", "href")),
      guid: cleanText(tagValue(block, "guid") || tagValue(block, "id")),
      publishedAt: cleanText(
        tagValue(block, "pubDate") ||
          tagValue(block, "published") ||
          tagValue(block, "updated"),
      ),
    }))
    .filter((entry) => entry.title && entry.url);
}

function tagValue(block: string, tag: string): string {
  const match = block.match(
    new RegExp(
      `<${tag}\\b[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`,
      "iu",
    ),
  );
  return match?.[1] ?? "";
}

function attributeValue(
  block: string,
  tag: string,
  attribute: string,
): string {
  const match = block.match(
    new RegExp(
      `<${tag}\\b[^>]*\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)')[^>]*>`,
      "iu",
    ),
  );
  return match?.[1] ?? match?.[2] ?? "";
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

function normalizeDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? new Date(0).toISOString()
    : parsed.toISOString();
}
