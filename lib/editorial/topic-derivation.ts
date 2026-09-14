/**
 * Turns what a story is about into durable topics.
 *
 * The pipeline already produces the raw material - the category it filed
 * under, and the search queries the SEO stage believes readers use - but none
 * of it was ever stored. `article_topics` sat empty, which silently emptied
 * three things at once: the `keywords` field in structured data, the topic
 * pages, and the internal link graph between articles.
 *
 * Topics are derived, not invented. Nothing here asserts a fact about the
 * story; it records the subjects the story is filed under.
 */

export type DerivedTopic = {
  slug: string;
  name: string;
  kind: "CATEGORY" | "SUBJECT";
};

/** Search queries are phrases, not subjects. These words never carry meaning. */
const QUERY_NOISE = new Set([
  "the", "a", "an", "and", "or", "of", "in", "on", "at", "to", "for", "with",
  "from", "by", "vs", "versus", "how", "what", "when", "where", "why", "who",
  "best", "top", "new", "latest", "news", "update", "updates", "guide",
  "highlights", "results", "schedule", "time", "today", "live", "stream",
  "streaming", "watch", "online", "free", "full", "video", "photos", "cast",
  "review", "reviews", "explained", "recap", "score", "scores", "stats",
]);

export function topicSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");
}

const CATEGORY_NAMES: Readonly<Record<string, string>> = {
  US_NEWS: "U.S. News",
  WORLD: "World",
  POLITICS: "Politics",
  BUSINESS: "Business",
  FINANCE: "Finance",
  TECHNOLOGY: "Technology",
  SCIENCE: "Science",
  HEALTH: "Health",
  SPORTS: "Sports",
  ENTERTAINMENT: "Entertainment",
  GAMING: "Gaming",
  WEATHER: "Weather",
  INTERNET_TRENDS: "Internet",
};

function isLowercase(value: string): boolean {
  return value === value.toLowerCase();
}

/** "ryan garcia" as typed becomes "Ryan Garcia" as displayed. */
function titleCaseIfNeeded(value: string): string {
  if (!isLowercase(value)) return value;
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Extracts the recurring subject of a set of search queries.
 *
 * A query like "Abigail Breslin new movies 2026" contains one subject and a
 * lot of query scaffolding. A phrase is only treated as a subject when it
 * appears in more than one query, because a name a reader searches for
 * repeatedly is a subject and a one-off word combination is not.
 *
 * Matching is case-insensitive by necessity. Requiring every word to be
 * capitalised looked like a cheap proper-noun test, but readers - and the SEO
 * stage that imitates them - type in lowercase, so "ryan garcia" and "social
 * security" were rejected outright. Only the few queries that happened to be
 * capitalised ever produced a subject, which left 18 of 22 articles filed under
 * nothing but their category.
 */
export function subjectsFromQueries(
  queries: readonly string[],
  { minimumOccurrences = 2, limit = 6 }: {
    minimumOccurrences?: number;
    limit?: number;
  } = {},
): string[] {
  const counts = new Map<string, { display: string; count: number }>();

  for (const query of queries) {
    const words = query.split(/\s+/u).filter(Boolean);
    const seenInQuery = new Set<string>();

    // Two- and three-word windows, which is the shape of a name or a title.
    for (let size = 3; size >= 2; size -= 1) {
      for (let start = 0; start + size <= words.length; start += 1) {
        const window = words.slice(start, start + size);
        if (window.some((word) => QUERY_NOISE.has(word.toLowerCase()))) {
          continue;
        }
        // A year belongs to an event name - "Sundance 2026" - but only after
        // it, never as the subject itself.
        const isYear = (word: string) => /^(?:19|20)\d{2}$/u.test(word);
        if (isYear(window[0]) || /^\d/u.test(window[0])) continue;
        if (window.some((word, position) => position > 0 && /^\d/u.test(word) && !isYear(word))) {
          continue;
        }

        const display = window.join(" ");
        const key = display.toLowerCase();
        if (seenInQuery.has(key)) continue;
        seenInQuery.add(key);

        const existing = counts.get(key);
        if (existing) {
          existing.count += 1;
          // Queries are usually typed in lowercase, so the first sighting is
          // rarely the best rendering of a name. Keep any properly cased form.
          if (isLowercase(existing.display) && !isLowercase(display)) {
            existing.display = display;
          }
        } else counts.set(key, { display, count: 1 });
      }
    }
  }

  const ranked = [...counts.values()]
    .filter((entry) => entry.count >= minimumOccurrences)
    .map((entry) => ({ ...entry, display: titleCaseIfNeeded(entry.display) }))
    .sort(
      (left, right) =>
        right.display.length - left.display.length || right.count - left.count,
    )
    .map((entry) => entry.display);

  // Overlapping windows describe one subject three ways - "Colton Smith",
  // "Colton Smith ATP", "Smith ATP". Keeping all of them would fragment the
  // topic pages and the internal links across near-duplicates, so the longest
  // form wins and anything contained within it is dropped.
  const kept: string[] = [];
  for (const subject of ranked) {
    const lower = subject.toLowerCase();
    if (kept.some((existing) => existing.toLowerCase().includes(lower))) {
      continue;
    }
    kept.push(subject);
    if (kept.length >= limit) break;
  }
  return kept;
}

export function deriveTopics(input: {
  category: string;
  secondaryQueries?: readonly string[];
}): DerivedTopic[] {
  const topics: DerivedTopic[] = [];
  const seen = new Set<string>();

  const categoryKey = input.category.trim().toUpperCase();
  const categoryName =
    CATEGORY_NAMES[categoryKey] ??
    categoryKey
      .split(/[_\s]+/u)
      .filter(Boolean)
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  const categorySlug = topicSlug(categoryName);
  if (categorySlug) {
    topics.push({ slug: categorySlug, name: categoryName, kind: "CATEGORY" });
    seen.add(categorySlug);
  }

  for (const subject of subjectsFromQueries(input.secondaryQueries ?? [])) {
    const slug = topicSlug(subject);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    topics.push({ slug, name: subject, kind: "SUBJECT" });
  }

  return topics;
}

/**
 * The keyword list for structured data. Search queries are what readers
 * actually type, so they are more useful here than the topic names, but they
 * are capped and de-duplicated so the field stays a summary rather than a
 * keyword dump - which search engines discount.
 */
export function keywordsFor(input: {
  topics: readonly string[];
  secondaryQueries?: readonly string[];
}): string {
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const value of [...input.topics, ...(input.secondaryQueries ?? [])]) {
    const trimmed = value.trim().replace(/\s+/gu, " ");
    if (trimmed.length < 3) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(trimmed);
    if (keywords.length >= 12) break;
  }

  return keywords.join(", ");
}
