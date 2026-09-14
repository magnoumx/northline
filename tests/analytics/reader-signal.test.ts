import { describe, expect, it } from "vitest";
import {
  classifyTrafficSource,
  createAnonymousId,
  isEngagedRead,
  isValidArticleId,
  looksAutomated,
  scrollBucketsCrossed,
} from "../../lib/analytics/reader-signal";

describe("article identifiers", () => {
  it("accepts the format Northline actually issues", () => {
    // The ingest route validated these as UUIDs, so every event naming an
    // article was rejected and the table stayed empty.
    expect(isValidArticleId("article_09dc5cWVUHPq0gtr3h8PtR15wtCqe1_j")).toBe(
      true,
    );
  });

  it("rejects anything that is not an article id", () => {
    for (const value of [
      "",
      "article_",
      "3f8c1e2a-0b6d-4e5f-9a1b-2c3d4e5f6a7b",
      "article_short",
      "'; DROP TABLE analytics_events;--",
      null,
    ]) {
      expect(isValidArticleId(value as string), String(value)).toBe(false);
    }
  });
});

describe("engaged reading", () => {
  it("requires both dwell time and movement", () => {
    expect(isEngagedRead({ visibleSeconds: 40, maxScrollPercent: 60 })).toBe(
      true,
    );
  });

  it("does not count a tab left open", () => {
    // Time alone is not reading; an abandoned tab would otherwise be the most
    // "engaged" session on the site.
    expect(isEngagedRead({ visibleSeconds: 3600, maxScrollPercent: 0 })).toBe(
      false,
    );
  });

  it("does not count a bounce", () => {
    expect(isEngagedRead({ visibleSeconds: 2, maxScrollPercent: 90 })).toBe(
      false,
    );
  });
});

describe("scroll buckets", () => {
  it("reports each depth once", () => {
    const sent = new Set<string>();
    const first = scrollBucketsCrossed(60, sent);
    expect(first).toEqual(["25", "50"]);
    first.forEach((bucket) => sent.add(bucket));

    expect(scrollBucketsCrossed(62, sent)).toEqual([]);
    expect(scrollBucketsCrossed(100, sent)).toEqual(["75", "100"]);
  });
});

describe("traffic source", () => {
  it("separates search from social from referral", () => {
    const self = "usnorthline.com";
    expect(classifyTrafficSource("https://www.google.com/search?q=x", self)).toBe(
      "SEARCH",
    );
    expect(classifyTrafficSource("https://t.co/abc", self)).toBe("SOCIAL");
    expect(classifyTrafficSource("https://example.com/post", self)).toBe(
      "REFERRAL",
    );
  });

  it("treats our own pages and an absent referrer as direct", () => {
    const self = "usnorthline.com";
    expect(classifyTrafficSource("", self)).toBe("DIRECT");
    expect(
      classifyTrafficSource("https://usnorthline.com/latest", self),
    ).toBe("DIRECT");
    expect(
      classifyTrafficSource("https://www.usnorthline.com/latest", self),
    ).toBe("DIRECT");
  });

  it("never returns anything derived from the full referrer", () => {
    // Only the host is inspected; a search query in the referrer is discarded.
    const result = classifyTrafficSource(
      "https://www.google.com/search?q=private+medical+question",
      "usnorthline.com",
    );
    expect(result).toBe("SEARCH");
  });
});

describe("automated traffic", () => {
  it("excludes crawlers, monitors and empty agents", () => {
    for (const agent of [
      "Mozilla/5.0 (compatible; Googlebot/2.1)",
      "curl/8.18.0",
      "HeadlessChrome/120",
      "Chrome-Lighthouse",
      "facebookexternalhit/1.1",
      "",
    ]) {
      expect(looksAutomated(agent), agent || "(empty)").toBe(true);
    }
  });

  it("admits an ordinary browser", () => {
    expect(
      looksAutomated(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
      ),
    ).toBe(false);
  });
});

describe("anonymous id", () => {
  it("is random and carries nothing personal", () => {
    const first = createAnonymousId();
    const second = createAnonymousId();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[0-9a-f]{48}$/u);
  });
});

describe("server-side exclusion", () => {
  it("refuses automated traffic at the origin, not only in the browser", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const route = readFileSync(
      fileURLToPath(
        new URL("../../app/api/analytics/events/route.ts", import.meta.url),
      ),
      "utf8",
    );
    // A crawler never runs the client guard, so the origin has to enforce it.
    expect(route).toContain("looksAutomated(request.headers.get");
    // And it must refuse before anything is written.
    const guard = route.indexOf("looksAutomated(request.headers.get");
    const insert = route.indexOf("db.insert(analyticsEvents)");
    expect(guard).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(guard);
  });

  it("accepts the article id format the site issues", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const route = readFileSync(
      fileURLToPath(
        new URL("../../app/api/analytics/events/route.ts", import.meta.url),
      ),
      "utf8",
    );
    expect(route).not.toContain("z.string().uuid()");
    expect(route).toContain("^article_[A-Za-z0-9_-]{10,64}$");
  });
});
