import { createD1PublicContentRepository } from "./d1-public-repository";
import { createFixtureContentRepository } from "./fixture-repository";
import type { Story, Trend } from "../site/types";
import { describePeriod, rankMostRead } from "./most-read";
import type {
  ContentEnvironment,
  PublicContentRepository,
  PublicContentSnapshot,
} from "./types";

const CACHE_TTL_MS = 30_000;
let cachedSnapshot:
  | { expiresAt: number; value: Promise<PublicContentSnapshot> }
  | undefined;

export function resolveContentMode(
  environment: ContentEnvironment = process.env as ContentEnvironment,
): "DATABASE" | "DEMO_FIXTURES" {
  const configuredSiteUrl = environment.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
  const productionSiteConfigured = /^https:\/\/(?:www\.)?usnorthline\.com(?:\/|$)/iu.test(
    configuredSiteUrl,
  );
  const appEnvironment =
    environment.APP_ENV ??
    (environment.NODE_ENV === "production" || productionSiteConfigured
      ? "production"
      : "development");
  const requestedDemo =
    environment.DEMO_CONTENT_MODE === "true" ||
    (environment.DEMO_CONTENT_MODE === undefined &&
      (appEnvironment === "development" || appEnvironment === "test"));
  if (appEnvironment === "production" && requestedDemo) {
    throw new Error("Production startup rejects DEMO_CONTENT_MODE.");
  }
  // Preview and staging must exercise the real D1-backed control plane. A stale
  // DEMO_CONTENT_MODE secret must never turn a deployed newsroom into a
  // fictional snapshot. Fixtures remain available only in local development
  // and test environments.
  if (
    environment.NODE_ENV === "production" ||
    productionSiteConfigured ||
    appEnvironment === "preview" ||
    appEnvironment === "staging"
  ) {
    return "DATABASE";
  }
  return requestedDemo ? "DEMO_FIXTURES" : "DATABASE";
}

export function createPublicContentRepository(
  environment: ContentEnvironment = process.env as ContentEnvironment,
): PublicContentRepository {
  return resolveContentMode(environment) === "DEMO_FIXTURES"
    ? createFixtureContentRepository()
    : createD1PublicContentRepository();
}

export async function getPublicContentSnapshot(
  options: {
    environment?: ContentEnvironment;
    repository?: PublicContentRepository;
    now?: number;
    bypassCache?: boolean;
  } = {},
): Promise<PublicContentSnapshot> {
  const now = options.now ?? Date.now();
  if (
    !options.repository &&
    !options.environment &&
    !options.bypassCache &&
    cachedSnapshot &&
    cachedSnapshot.expiresAt > now
  ) {
    return cachedSnapshot.value;
  }
  const repository =
    options.repository ??
    createPublicContentRepository(
      options.environment ?? (process.env as ContentEnvironment),
    );
  const mode = options.environment
    ? resolveContentMode(options.environment)
    : resolveContentMode();
  const value = buildSnapshot(repository, mode);
  if (!options.repository && !options.environment && !options.bypassCache) {
    cachedSnapshot = { expiresAt: now + CACHE_TTL_MS, value };
  }
  return value;
}

/** Full canonical archive for permanent sitemaps. Never snapshot-capped. */
export async function listPublishedStoryIndex(
  options: {
    environment?: ContentEnvironment;
    repository?: PublicContentRepository;
  } = {},
) {
  const repository =
    options.repository ??
    createPublicContentRepository(
      options.environment ?? (process.env as ContentEnvironment),
    );
  return repository.listPublishedStoryIndex();
}

/** A real page of the archive - see listPublishedStoriesPage on the repository. */
export async function getPublishedStoriesPage(
  input: { offset?: number; limit?: number },
  options: {
    environment?: ContentEnvironment;
    repository?: PublicContentRepository;
  } = {},
) {
  const repository =
    options.repository ??
    createPublicContentRepository(
      options.environment ?? (process.env as ContentEnvironment),
    );
  return repository.listPublishedStoriesPage(input);
}

export async function getPublishedStory(
  slug: string,
  options: {
    environment?: ContentEnvironment;
    repository?: PublicContentRepository;
  } = {},
) {
  const repository =
    options.repository ??
    createPublicContentRepository(
      options.environment ?? (process.env as ContentEnvironment),
    );
  return repository.findPublishedStoryBySlug(slug);
}

export function invalidatePublicContentCache(): void {
  cachedSnapshot = undefined;
}

const PUBLIC_SNAPSHOT_STORY_LIMIT = 60;

async function buildSnapshot(
  repository: PublicContentRepository,
  mode: PublicContentSnapshot["mode"],
): Promise<PublicContentSnapshot> {
  const [stories, trends, readership] = await Promise.all([
    // Do not raise this without measuring. Hydrating 500 stories per request
    // exceeded D1's per-query CPU limit and took the homepage and feeds down
    // (2026-10-15). Topic pages and the image sitemap that outgrow sixty belong
    // on their own bounded queries, not on a bigger shared snapshot.
    repository.listPublishedStories(PUBLIC_SNAPSHOT_STORY_LIMIT),
    repository.listPublishedTrends(10),
    repository.listMostReadArticleIds(48),
  ]);
  const featuredStory = stories[0] ?? null;
  const ranking = rankMostRead(readership, { periodHours: 48 });
  const storyById = new Map(stories.map((story) => [story.id, story]));
  const mostReadStories = ranking.entries
    .map((entry) => storyById.get(entry.articleId))
    .filter((story): story is Story => Boolean(story));
  // A trend we have not covered is a dead end: the reader clicks a headline-
  // sized term and lands on "0 results". Trends are matched to published
  // coverage, and anything we cannot actually serve is not offered.
  const publishedTrends = attachTrendCoverage(trends, stories);
  const liveUpdates = stories
    .filter((story) => story.status === "Live" || story.status === "Developing")
    .slice(0, 6)
    .map((story) => ({
      time: story.updated,
      title: story.headline,
      detail: story.summary,
      story,
    }));
  return {
    stories,
    featuredStory,
    // Measured, or absent. "Most read" was the newest five under a heading
    // that claimed they were the most read; the ranking is only offered when
    // enough was actually measured to support one.
    mostRead: mostReadStories,
    mostReadPeriod: ranking.insufficientData
      ? null
      : describePeriod(ranking.periodHours),
    trends: publishedTrends,
    liveUpdates,
    // The comparison used to be built once from the featured story and then
    // rendered on every article, so a cycling report showed diplomacy sources.
    // It is now derived per story from that story's own version.
    sourceComparison: buildSourceComparison(featuredStory),
    mode,
  };
}

export function buildSourceComparison(
  story: Pick<Story, "sources"> | null | undefined,
): PublicContentSnapshot["sourceComparison"] {
  return (story?.sources ?? []).slice(0, 4).map((source) => ({
    source: source.name,
    focus: source.kind,
    adds: source.note,
    omits: "See the source record for scope and limitations.",
  }));
}

/**
 * Links each trend to a story that genuinely covers it, and drops the rest.
 *
 * Trend terms come from search-demand connectors, not from the newsroom, so
 * most of them are subjects nobody here has written about. Listing them made
 * the page look like an index of coverage that does not exist.
 */
function attachTrendCoverage(
  trends: Trend[],
  stories: Story[],
): Trend[] {
  const meaningful = (value: string) =>
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .filter((word) => word.length >= 4);

  return trends.flatMap((trend) => {
    if (trend.storySlug) return [trend];
    const terms = meaningful(trend.term);
    if (terms.length === 0) return [];
    const match = stories.find((story) => {
      const haystack = `${story.headline} ${story.dek} ${story.topics.join(" ")}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
    // Kept, but without a story slug. The page presents these as rising
    // subjects we have not covered yet rather than as links to nothing.
    return [match ? { ...trend, storySlug: match.slug } : trend];
  });
}
