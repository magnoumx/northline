import { describe, expect, it, vi } from "vitest";
import {
  ConnectorError,
  ConnectorRunner,
  GdeltTrendConnector,
  GoogleTrendsConnector,
  RssTrendConnector,
  SearchConnector,
  parseRssOrAtom,
  resolveConnectorRuntimeConfiguration,
  type Connector,
} from "../../lib/connectors";

function operationalConfiguration() {
  return {
    ...resolveConnectorRuntimeConfiguration({
      CONNECTORS_ENABLED: "true",
      CONNECTORS_GLOBAL_KILL: "false",
    }),
    retryAttempts: 1,
    circuitFailureThreshold: 1,
    circuitCooldownMs: 5_000,
  };
}

describe("connector runtime isolation", () => {
  it("is disabled and globally killed by default", () => {
    expect(resolveConnectorRuntimeConfiguration({})).toMatchObject({
      enabled: false,
      globalKill: true,
      gdeltEnabled: false,
      googleTrendsEnabled: false,
      rssEnabled: false,
      searchEnabled: false,
    });
  });

  it("opens only the failing connector circuit", async () => {
    const failing: Connector<string, string> = {
      id: "failing",
      kind: "search",
      async execute() {
        throw new ConnectorError(
          "CONNECTOR_UNAVAILABLE",
          "failed",
          true,
        );
      },
    };
    const healthy: Connector<string, string> = {
      id: "healthy",
      kind: "search",
      async execute() {
        return ["result"];
      },
    };
    const runner = new ConnectorRunner(operationalConfiguration());
    expect(await runner.run(failing, "query")).toMatchObject({
      ok: false,
      health: { state: "open" },
    });
    expect(await runner.run(healthy, "query")).toMatchObject({
      ok: true,
      items: ["result"],
      health: { state: "closed" },
    });
  });
});

describe("source connectors", () => {
  it("normalizes GDELT results and drops unsafe article URLs", async () => {
    let capturedRedirect: RequestRedirect | undefined;
    const fetcher: typeof fetch = async (_input, init) => {
      capturedRedirect = init?.redirect;
      return new Response(
        JSON.stringify({
          articles: [
            {
              title: "A verified headline",
              url: "https://news.example.org/story",
              domain: "news.example.org",
              seendate: "20260724T120000Z",
              language: "English",
            },
            {
              title: "Unsafe",
              url: "http://127.0.0.1/private",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const connector = new GdeltTrendConnector(fetcher);
    const results = await connector.execute(
      { query: "United States", limit: 10 },
      { signal: new AbortController().signal },
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      connectorId: "gdelt-doc",
      title: "A verified headline",
      observedAt: "2026-07-24T12:00:00.000Z",
    });
    expect(capturedRedirect).toBe("manual");
  });

  it("parses Google Trends RSS and keeps the official endpoint pinned", async () => {
    let capturedRedirect: RequestRedirect | undefined;
    const xml = `<?xml version="1.0"?><rss xmlns:ht="https://trends.google.com/trending/rss"><channel><item>
      <title><![CDATA[Example launch]]></title>
      <link>https://www.google.com/search?q=example+launch</link>
      <pubDate>Fri, 24 Jul 2026 12:00:00 GMT</pubDate>
      <ht:approx_traffic>50K+</ht:approx_traffic>
      <ht:news_item_url>https://publisher.example.org/story</ht:news_item_url>
      <ht:news_item_source>Example Publisher</ht:news_item_source>
    </item></channel></rss>`;
    const connector = new GoogleTrendsConnector(undefined, async (_input, init) => {
      capturedRedirect = init?.redirect;
      return new Response(xml, {
        status: 200,
        headers: { "content-type": "application/rss+xml" },
      });
    });
    const results = await connector.execute(
      { limit: 10 },
      { signal: new AbortController().signal },
    );
    expect(capturedRedirect).toBe("manual");
    expect(results[0]).toMatchObject({
      connectorId: "google-trends-us",
      title: "Example launch",
      source: "Example Publisher",
      metadata: { approximateTraffic: 50_000 },
    });
    expect(() =>
      new GoogleTrendsConnector("https://example.com/feed.xml"),
    ).toThrowError(
      expect.objectContaining({ code: "CONNECTOR_CONFIGURATION_INVALID" }),
    );
  });

  it("parses bounded RSS/Atom data and rejects entity declarations", async () => {
    const xml = `<?xml version="1.0"?>
      <rss><channel><item>
        <title><![CDATA[Example &amp; update]]></title>
        <link>https://publisher.example.org/story</link>
        <guid>story-1</guid>
        <pubDate>Fri, 24 Jul 2026 12:00:00 GMT</pubDate>
      </item></channel></rss>`;
    expect(parseRssOrAtom(xml)).toMatchObject([
      {
        title: "Example & update",
        url: "https://publisher.example.org/story",
      },
    ]);
    expect(() =>
      parseRssOrAtom(
        '<!DOCTYPE x [<!ENTITY secret SYSTEM "file:///etc/passwd">]><rss/>',
      ),
    ).toThrowError(
      expect.objectContaining({ code: "CONNECTOR_RESPONSE_INVALID" }),
    );

    const connector = new RssTrendConnector(
      {
        id: "wire",
        url: "https://feeds.example.org/news.xml",
        sourceName: "Example Wire",
      },
      {
        async fetchFeed() {
          return {
            body: xml,
            finalUrl: "https://feeds.example.org/news.xml",
            contentType: "application/rss+xml",
          };
        },
      },
    );
    const results = await connector.execute(
      { feedId: "wire" },
      { signal: new AbortController().signal },
    );
    expect(results[0]).toMatchObject({
      connectorId: "rss:wire",
      source: "Example Wire",
    });
  });

  it("keeps provider credentials behind the search transport and filters unsafe URLs", async () => {
    const search = vi.fn(async () => [
      {
        title: "Public result",
        url: "https://search.example.org/result",
        snippet: "A result",
      },
      {
        title: "Private result",
        url: "http://localhost/admin",
      },
    ]);
    const connector = new SearchConnector("approved-search", { search });
    const results = await connector.execute(
      { query: "public records" },
      { signal: new AbortController().signal },
    );
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ query: "public records", limit: 20 }),
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.url).toBe("https://search.example.org/result");
  });
});
