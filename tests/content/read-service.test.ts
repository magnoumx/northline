import { describe, expect, it } from "vitest";
import {
  getPublicContentSnapshot,
  resolveContentMode,
} from "../../lib/content/read-service";
import type { PublicContentRepository } from "../../lib/content/types";

describe("public content boundary", () => {
  it("rejects fixture content in production", () => {
    expect(() =>
      resolveContentMode({
        APP_ENV: "production",
        DEMO_CONTENT_MODE: "true",
      }),
    ).toThrow(/rejects DEMO_CONTENT_MODE/i);
  });

  it("defaults fixtures only in development and test", () => {
    expect(resolveContentMode({ APP_ENV: "development" })).toBe(
      "DEMO_FIXTURES",
    );
    expect(
      resolveContentMode({
        APP_ENV: "production",
        DEMO_CONTENT_MODE: "false",
      }),
    ).toBe("DATABASE");
    expect(
      resolveContentMode({
        NODE_ENV: "production",
        APP_ENV: "development",
        DEMO_CONTENT_MODE: "true",
      }),
    ).toBe("DATABASE");
    expect(
      resolveContentMode({
        APP_ENV: "preview",
        DEMO_CONTENT_MODE: "true",
      }),
    ).toBe("DATABASE");
  });

  it("builds the public snapshot through a repository abstraction", async () => {
    const repository: PublicContentRepository = {
      async listPublishedStories() {
        return [];
      },
      async listPublishedStoriesPage() {
        return { stories: [], total: 0 };
      },
      async findPublishedStoryBySlug() {
        throw new Error("not used");
      },
      async listMostReadArticleIds() {
        return [];
      },
      async listPublishedStoryIndex() {
        return [];
      },
      async listPublishedTrends() {
        return [];
      },
    };
    const snapshot = await getPublicContentSnapshot({
      repository,
      environment: {
        APP_ENV: "test",
        DEMO_CONTENT_MODE: "true",
      },
      bypassCache: true,
    });
    expect(snapshot).toMatchObject({
      stories: [],
      featuredStory: null,
      mode: "DEMO_FIXTURES",
    });
  });
});
