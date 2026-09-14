import { describe, expect, it } from "vitest";
import { isNewsSitemapEligible } from "../../lib/seo/sitemap-eligibility";
import type { Story } from "../../lib/site/types";

function story(
  overrides: Partial<Story> = {},
): Story {
  return {
    slug: "verified-update",
    category: "Technology",
    eyebrow: "Technology",
    headline: "A verified update with an accurate publication date",
    dek: "A summary.",
    summary: "A summary.",
    status: "Verified",
    format: "Standard",
    published: "July 24, 2026",
    updated: "July 24, 2026",
    publishedAtIso: "2026-07-24T10:00:00.000Z",
    updatedAtIso: "2026-07-24T10:00:00.000Z",
    readTime: 2,
    image: "/og.png",
    imageAlt: "Northline",
    imageCredit: "",
    accent: "blue",
    score: 0,
    trend: 0,
    author: "Editorial Desk",
    reviewer: "Standards Desk",
    topics: [],
    whyItMatters: "Reader context.",
    whyTrending: "",
    keyFacts: [],
    body: [],
    timeline: [],
    sources: [],
    uncertainties: [],
    next: "",
    isDemo: false,
    ...overrides,
  };
}

describe("news sitemap eligibility", () => {
  const now = new Date("2026-07-24T12:00:00.000Z");

  it("accepts only real stories published within the last 48 hours", () => {
    expect(isNewsSitemapEligible(story(), now)).toBe(true);
    expect(
      isNewsSitemapEligible(
        story({ publishedAtIso: "2026-07-22T11:59:59.000Z" }),
        now,
      ),
    ).toBe(false);
    expect(isNewsSitemapEligible(story({ isDemo: true }), now)).toBe(false);
  });

  it("rejects invalid and materially future publication dates", () => {
    expect(
      isNewsSitemapEligible(story({ publishedAtIso: "not-a-date" }), now),
    ).toBe(false);
    expect(
      isNewsSitemapEligible(
        story({ publishedAtIso: "2026-07-24T12:06:00.000Z" }),
        now,
      ),
    ).toBe(false);
  });
});
