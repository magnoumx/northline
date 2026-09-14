import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { keywordsFor } from "../../lib/editorial/topic-derivation";

function read(relative: string): string {
  return readFileSync(
    fileURLToPath(new URL(relative, import.meta.url)),
    "utf8",
  ).replace(/\s+/gu, " ");
}

describe("article keywords", () => {
  it("does not reduce to the category when queries exist", () => {
    // 18 of 22 published articles carried topics of exactly ["U.S. News"], so
    // joining topics published the same single keyword on nearly every story.
    const keywords = keywordsFor({
      topics: ["U.S. News"],
      secondaryQueries: [
        "2027 social security cola",
        "social security raise 2027",
        "cola increase medicare part b",
      ],
    });
    expect(keywords).toContain("2027 social security cola");
    expect(keywords).not.toBe("U.S. News");
    expect(keywords.split(", ").length).toBeGreaterThan(1);
  });

  it("still yields something when only the category is known", () => {
    expect(keywordsFor({ topics: ["Sports"] })).toBe("Sports");
  });

  it("caps the list rather than dumping every query", () => {
    const keywords = keywordsFor({
      topics: ["Sports"],
      secondaryQueries: Array.from({ length: 40 }, (_, i) => `query number ${i}`),
    });
    expect(keywords.split(", ").length).toBeLessThanOrEqual(12);
  });

  it("de-duplicates a topic that repeats a query", () => {
    const keywords = keywordsFor({
      topics: ["Justin Hartley"],
      secondaryQueries: ["justin hartley", "Justin Hartley tracker"],
    });
    expect(keywords.toLowerCase().split(", ").filter((k) => k === "justin hartley")).toHaveLength(1);
  });
});

describe("the queries reach the renderer", () => {
  it("is persisted, since nothing can be built from a dropped field", () => {
    // secondaryQueries was produced by the SEO stage and then discarded, so
    // keywordsFor had no source and sat unused.
    expect(read("../../lib/editorial/article-input.ts")).toContain(
      "secondaryQueries:",
    );
    expect(read("../../lib/editorial/autonomous-newsroom.ts")).toContain(
      "secondaryQueries: research.data.seo.secondaryQueries,",
    );
  });

  it("is read back out for the story", () => {
    expect(read("../../lib/content/d1-public-repository.ts")).toContain(
      "searchQueries:",
    );
  });

  it("is what structured data actually publishes", () => {
    const structuredData = read("../../components/structured-data.tsx");
    expect(structuredData).toContain("keywords: keywordsFor({");
    expect(structuredData).not.toContain('keywords: story.topics.join(", ")');
  });
});
