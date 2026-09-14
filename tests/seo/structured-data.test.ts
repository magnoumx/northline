import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const componentSource = (relativePath: string) =>
  readFileSync(
    fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)),
    "utf8",
  );

const structuredData = componentSource("components/structured-data.tsx");
const storyPage = componentSource("components/public/story-pages.tsx");

function speakableSelectors(): string[] {
  const block = /cssSelector:\s*\[([^\]]+)\]/u.exec(structuredData);
  if (!block) throw new Error("speakable cssSelector block not found");
  return [...block[1].matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
}

describe("story structured data", () => {
  it("points every speakable selector at markup that is actually rendered", () => {
    const rendered = storyPage;
    const selectors = speakableSelectors();

    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      // ".article-page__header h1" -> the class is the part that must exist.
      const className = selector.split(" ")[0].replace(/^\./u, "");
      expect(rendered, `${selector} is not rendered anywhere`).toContain(
        className,
      );
    }
  });

  it("does not claim a desk byline is a named person", () => {
    expect(structuredData).toContain("DESK_BYLINE");
    // The regression: a hardcoded Person entity for every byline.
    expect(structuredData).not.toMatch(
      /author:\s*\{\s*"@type":\s*"Person"/u,
    );
  });

  it("publishes the evidence as citations", () => {
    expect(structuredData).toContain("citation: citations");
    expect(structuredData).toContain('locator.startsWith("https://")');
  });
});
