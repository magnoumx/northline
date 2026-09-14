import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const topicPage = readFileSync("app/[...slug]/page.tsx", "utf8");
const sitemap = readFileSync("app/sitemaps/pages.xml/route.ts", "utf8");

/**
 * Search Console showed 82 URLs "Discovered - currently not indexed" and none of
 * them crawled. On a domain that new the constraint is crawl budget, and 43 of
 * the site's topic pages held a single article each - an 84-word page that is a
 * mirror of the story it links to, marked `index, follow`, and linked from every
 * article. They competed with the reporting for the crawls Google was willing to
 * spend.
 */
describe("thin topic pages", () => {
  it("marks a topic page noindex until it holds enough stories", () => {
    expect(topicPage).toContain("MINIMUM_INDEXABLE_TOPIC_STORIES");
    expect(topicPage).toMatch(/const MINIMUM_INDEXABLE_TOPIC_STORIES = 3;/);
    expect(topicPage).toContain("{ robots: { index: false, follow: true } }");
  });

  it("keeps following links out of a thin topic page", () => {
    // noindex, but follow: the stories it links to still need the signal.
    expect(topicPage).not.toMatch(/thin \? \{ index: false, follow: false \}/);
  });

  it("drops the canonical on a page it is telling Google not to index", () => {
    expect(topicPage).toMatch(/alternates: thin \? undefined :/);
  });

  it("lets a healthy topic page inherit the layout's robots directives", () => {
    // `robots: undefined` does not mean "inherit" in Next.js - it clears the
    // parent value. That shipped, and every healthy topic page lost
    // max-image-preview:large, which Google Discover requires for a large card.
    // The key has to be absent, not undefined.
    expect(topicPage).not.toContain("robots: thin ? { index: false, follow: true } : undefined");
    expect(topicPage).toMatch(/\.\.\.\(thin \? \{ robots: \{ index: false, follow: true \} \} : \{\}\)/);
  });

  it("does not submit a noindex topic page in the sitemap", () => {
    // Submitting a URL and then refusing to index it wastes the crawl twice.
    expect(sitemap).toMatch(/topicStoryCount\.get\(slug\) \?\? 0\) >= 3/);
  });
});
