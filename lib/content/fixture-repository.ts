import {
  stories as fixtureStories,
  trends as fixtureTrends,
} from "../../dev/fixtures/site-data";
import type { PublicContentRepository } from "./types";

const publicationDates: Record<string, [string, string]> = {
  "neighborhood-batteries-heat-grid": [
    "2026-07-24T12:10:00.000Z",
    "2026-07-24T15:42:00.000Z",
  ],
  "relay-ai-device-private-beta": [
    "2026-07-24T13:25:00.000Z",
    "2026-07-24T13:25:00.000Z",
  ],
  "aurora-3-final-test": [
    "2026-07-23T20:40:00.000Z",
    "2026-07-24T11:05:00.000Z",
  ],
  "harbor-city-final-comeback": [
    "2026-07-24T03:18:00.000Z",
    "2026-07-24T03:55:00.000Z",
  ],
  "summer-light-festival-access": [
    "2026-07-23T18:15:00.000Z",
    "2026-07-23T19:01:00.000Z",
  ],
  "driftline-cooperative-mode": [
    "2026-07-22T17:20:00.000Z",
    "2026-07-22T17:20:00.000Z",
  ],
};

const stories = fixtureStories.map((story) => {
  const [publishedAtIso, updatedAtIso] =
    publicationDates[story.slug] ??
    ["2026-07-24T12:00:00.000Z", "2026-07-24T12:00:00.000Z"];
  return {
    ...story,
    id: `demo-${story.slug}`,
    publishedAtIso,
    updatedAtIso,
    canonicalPath: `/story/${story.slug}`,
    isDemo: true,
  };
});

export function createFixtureContentRepository(): PublicContentRepository {
  return {
    async listPublishedStories(limit = 50) {
      return stories.slice(0, boundedLimit(limit));
    },
    async listPublishedStoriesPage({ offset = 0, limit = 24 }) {
      const start = Math.max(0, Math.trunc(offset));
      const end = start + Math.max(1, Math.min(50, Math.trunc(limit)));
      return { stories: stories.slice(start, end), total: stories.length };
    },
    async listPublishedStoryIndex() {
      return stories.map((story) => ({
        slug: story.slug,
        category: story.category ?? null,
        publishedAtIso: story.publishedAtIso ?? null,
        updatedAtIso: story.updatedAtIso ?? null,
      }));
    },
    // Fixtures carry no measurement, so the ranking is correctly empty and the
    // caller falls back to an honest label.
    async listMostReadArticleIds() {
      return [];
    },
    async findPublishedStoryBySlug(slug) {
      return stories.find((story) => story.slug === slug) ?? null;
    },
    async listPublishedTrends(limit = 10) {
      return fixtureTrends.slice(0, boundedLimit(limit));
    },
  };
}

function boundedLimit(limit: number): number {
  return Math.max(1, Math.min(100, Math.trunc(limit)));
}
