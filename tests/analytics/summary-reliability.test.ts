import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { coarseCountry } from "../../lib/analytics/reader-signal";

function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

describe("pageviews counts page views, not every reader event", () => {
  it("filters the count to PAGE_VIEW instead of counting every joined row", () => {
    // Every reader event carries an article_id, so COUNT(e.id) over the join
    // summed PAGE_VIEW, SCROLL_DEPTH, ENGAGED_READING, ARTICLE_COMPLETION and
    // SHARE together and called the total "pageviews" - one engaged read that
    // fired three event types counted as three views.
    const summary = read("../../app/api/newsroom/analytics/summary/route.ts");
    expect(summary).toContain(
      "SUM(CASE WHEN e.event_type='PAGE_VIEW' THEN 1 ELSE 0 END) AS pageviews",
    );
    expect(summary).not.toContain("COUNT(e.id) AS pageviews");
  });
});

// `cf` is a Cloudflare Workers runtime extension, not part of the Fetch
// standard, so Node's Request implementation silently drops it if passed
// through the constructor - it has to be attached directly, the same way
// lib/security/request-trust.ts does when it needs to preserve it.
function requestWithCf(cf: unknown): Request {
  const request = new Request("https://usnorthline.com/api/analytics/events");
  Object.defineProperty(request, "cf", { value: cf, enumerable: true });
  return request;
}

describe("country capture at ingestion", () => {
  it("reads Cloudflare's own edge-resolved country, never trusts client input", () => {
    expect(coarseCountry(requestWithCf({ country: "EG" }))).toBe("EG");
  });

  it("returns null rather than an invalid or spoofed value", () => {
    const noCf = new Request("https://usnorthline.com/api/analytics/events");
    expect(coarseCountry(noCf)).toBeNull();
    expect(coarseCountry(requestWithCf({ country: "not-a-country-code" }))).toBeNull();
  });

  it("is actually written into the stored event, not only computed and discarded", () => {
    // The summary dashboard has read metadata_json.country since it was
    // built; nothing in this route ever wrote it, so every country
    // breakdown was silently and permanently empty.
    const ingest = read("../../app/api/analytics/events/route.ts");
    expect(ingest).toContain("const country = coarseCountry(request);");
    expect(ingest).toContain("...parsed.data.properties, country");
  });
});

describe("a failed persist is visible somewhere, not only in an unread header", () => {
  it("logs the failure before returning the not-persisted response", () => {
    const ingest = read("../../app/api/analytics/events/route.ts");
    const catchBlock = ingest.slice(
      ingest.indexOf("} catch (error) {"),
      ingest.indexOf("x-analytics-result"),
    );
    expect(catchBlock).toContain("console.error(\"analytics_event_persist_failed\"");
  });
});
