import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  fileURLToPath(
    new URL("../../components/public/story-pages.tsx", import.meta.url),
  ),
  "utf8",
);

describe("related coverage", () => {
  it("no longer shows whichever three stories were newest", () => {
    // "Related coverage" was a heading over `stories.slice(0, 3)` - a claim the
    // selection could not support, and one that made every article recommend
    // the same three pages.
    expect(page).not.toMatch(
      /snapshot\.stories\s*\.filter\([^)]*\)\s*\.slice\(0, 3\)/u,
    );
    expect(page).toContain("rankRelatedStories(story, snapshot.stories)");
  });

  it("ranks a shared subject above a shared section", () => {
    const start = page.indexOf("function rankRelatedStories");
    const body = page.slice(start, start + 1400).replace(/\s+/gu, " ");
    expect(body).toContain(
      "right.shared - left.shared || right.sameCategory - left.sameCategory",
    );
  });

  it("uses recency only to break a tie", () => {
    const start = page.indexOf("function rankRelatedStories");
    const body = page.slice(start, start + 1400).replace(/\s+/gu, " ");
    // Recency is the last term in the comparator, never the first.
    const shared = body.indexOf("right.shared - left.shared");
    const published = body.indexOf("right.published - left.published");
    expect(shared).toBeGreaterThan(-1);
    expect(published).toBeGreaterThan(shared);
  });

  it("never recommends the article the reader is already on", () => {
    const start = page.indexOf("function rankRelatedStories");
    const body = page.slice(start, start + 1400).replace(/\s+/gu, " ");
    expect(body).toContain("candidate.slug !== story.slug");
  });
});
