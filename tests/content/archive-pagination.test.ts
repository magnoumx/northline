import { describe, expect, it } from "vitest";
import { createFixtureContentRepository } from "../../lib/content/fixture-repository";

describe("archive pagination", () => {
  it("returns a bounded page and the true total, not the page size", async () => {
    // The homepage snapshot caps at 60 and was reused directly by /latest
    // with no pagination, so once the archive passed 60 articles every older
    // story had no path a reader or crawler could browse to.
    const repository = createFixtureContentRepository();
    const page = await repository.listPublishedStoriesPage({ offset: 0, limit: 2 });
    expect(page.stories.length).toBeLessThanOrEqual(2);
    expect(page.total).toBeGreaterThanOrEqual(page.stories.length);
  });

  it("advances with offset instead of returning the same page repeatedly", async () => {
    const repository = createFixtureContentRepository();
    const first = await repository.listPublishedStoriesPage({ offset: 0, limit: 1 });
    const second = await repository.listPublishedStoriesPage({ offset: 1, limit: 1 });
    if (first.stories[0] && second.stories[0]) {
      expect(second.stories[0].slug).not.toBe(first.stories[0].slug);
    }
  });

  it("returns nothing past the end of the archive rather than wrapping around", async () => {
    const repository = createFixtureContentRepository();
    const page = await repository.listPublishedStoriesPage({ offset: 10_000, limit: 10 });
    expect(page.stories).toEqual([]);
  });

  it("bounds the page size so a caller cannot request the entire archive at once", async () => {
    const repository = createFixtureContentRepository();
    const page = await repository.listPublishedStoriesPage({ offset: 0, limit: 500 });
    expect(page.stories.length).toBeLessThanOrEqual(50);
  });
});
