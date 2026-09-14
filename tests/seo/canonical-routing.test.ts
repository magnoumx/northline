import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  fileURLToPath(new URL("../../app/[...slug]/page.tsx", import.meta.url)),
  "utf8",
);

describe("canonical article routing", () => {
  it("redirects alias paths instead of serving a second copy", () => {
    // Measured in production: /story, /news/<category>, /explainers, /visuals,
    // /video and /live all returned 200 for the same article, so one story
    // existed at six addresses and split its ranking signals six ways.
    expect(route).toContain("permanentRedirect(`/story/${second}`)");
    expect(route).toContain("permanentRedirect(`/story/${third}`)");
  });

  it("no longer renders an article component on an alias path", () => {
    const aliasBlock = route.slice(
      route.indexOf("// One article, one URL."),
      route.indexOf("permanentRedirect(`/story/${third}`)") + 200,
    );
    expect(aliasBlock).not.toContain("<StandardArticlePage");
    expect(aliasBlock).not.toContain("<StoryIntelligencePage");
  });

  it("keeps /story as the canonical article path", () => {
    expect(route).toContain('root === "story" && second && slug.length === 2');
    expect(route).toContain("<StoryIntelligencePage slug={second} />");
  });

  it("still 404s an alias for a story that does not exist", () => {
    // A redirect must never invent a destination for an unknown slug.
    // Collapsed so the assertion survives CRLF and line wrapping.
    const aliasBlock = route
      .slice(
        route.indexOf("// One article, one URL."),
        route.indexOf("permanentRedirect(`/story/${third}`)") + 200,
      )
      .replace(/\s+/gu, " ");
    expect(aliasBlock).toContain(
      "if (!(await getPublishedStory(second))) notFound();",
    );
    expect(aliasBlock).toContain("notFound()");
  });

  it("keeps the live blog as its own presentation, not an alias", () => {
    // A live blog is a genuinely different page, not a duplicate of the story.
    expect(route).toContain("<LiveBlogPage slug={second} />");
  });
});
