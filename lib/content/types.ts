import type { Story, Trend } from "../site/types";

export const PUBLIC_ARTICLE_STATES = [
  "PUBLISHED",
  "UPDATED",
  "CORRECTED",
] as const;

export type PublicArticleState = (typeof PUBLIC_ARTICLE_STATES)[number];

export type PublicContentSnapshot = {
  stories: Story[];
  featuredStory: Story | null;
  /** Measured ranking. Empty when too little was measured to rank honestly. */
  mostRead: Story[];
  /** Period the ranking covers, or null when there is no ranking to show. */
  mostReadPeriod: string | null;
  trends: Trend[];
  liveUpdates: Array<{
    time: string;
    title: string;
    detail: string;
    story: Story;
  }>;
  sourceComparison: Array<{
    source: string;
    focus: string;
    adds: string;
    omits: string;
  }>;
  mode: "DATABASE" | "DEMO_FIXTURES";
};

/** Minimal row used to build permanent sitemaps over the whole archive. */
export type PublishedStoryIndexEntry = {
  slug: string;
  /** Drives topic-page discovery in the sitemap. */
  category: string | null;
  publishedAtIso: string | null;
  updatedAtIso: string | null;
};

export type PublicContentRepository = {
  listPublishedStories(limit?: number): Promise<Story[]>;
  /** A real page of the archive, ordered newest first, with a total count. */
  listPublishedStoriesPage(input: {
    offset?: number;
    limit?: number;
  }): Promise<{ stories: Story[]; total: number }>;
  findPublishedStoryBySlug(slug: string): Promise<Story | null>;
  listPublishedTrends(limit?: number): Promise<Trend[]>;
  /**
   * Every canonical published story, not the capped homepage snapshot. The
   * permanent sitemap must cover the full archive as it grows.
   */
  listPublishedStoryIndex(): Promise<PublishedStoryIndexEntry[]>;
  /** Measured readership over a window, for a real "Most read" ranking. */
  listMostReadArticleIds(
    periodHours?: number,
  ): Promise<{ articleId: string; readers: number }[]>;
};

export type ContentEnvironment = {
  NODE_ENV?: string;
  APP_ENV?: string;
  DEMO_CONTENT_MODE?: string;
  NEXT_PUBLIC_SITE_URL?: string;
};
