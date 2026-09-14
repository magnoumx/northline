/**
 * Ranks articles by measured readership.
 *
 * "Most read" was `stories.slice(0, 5)` - the newest five, under a heading that
 * claimed they were the most read. Nothing measured them, because the analytics
 * table had never received an event.
 *
 * Two rules govern this:
 *
 *  1. A ranking is only offered when enough was measured to support one. Below
 *     the floor the caller gets nothing and must fall back to an honest label
 *     rather than dressing recency as popularity.
 *  2. The period is always returned with the ranking, because "most read" with
 *     no time range is not a claim anyone can check.
 */

export type MostReadEntry = {
  articleId: string;
  /** Distinct readers, not raw events: one person reloading is not ten people. */
  readers: number;
};

export type MostReadResult = {
  entries: MostReadEntry[];
  /** Hours the ranking covers, for display alongside it. */
  periodHours: number;
  /** True when measurement was too thin to rank honestly. */
  insufficientData: boolean;
};

/**
 * Below this, a ranking says more about who happened to visit than about what
 * is being read. A new publication sits here for a while, and that is fine -
 * the label just has to tell the truth in the meantime.
 */
export const MINIMUM_READERS_TO_RANK = 25;

export type ReadershipRow = {
  articleId: string | null;
  readers: number;
};

/**
 * Turns measured rows into a ranking, or declines to.
 *
 * `ENGAGED_READING` and `ARTICLE_COMPLETION` are the inputs rather than
 * `PAGE_VIEW`, because a page view counts arrivals and this is a claim about
 * reading.
 */
export function rankMostRead(
  rows: readonly ReadershipRow[],
  options: { periodHours?: number; limit?: number; minimumReaders?: number } = {},
): MostReadResult {
  const periodHours = options.periodHours ?? 48;
  const limit = options.limit ?? 5;
  const minimum = options.minimumReaders ?? MINIMUM_READERS_TO_RANK;

  const entries = rows
    .filter(
      (row): row is { articleId: string; readers: number } =>
        typeof row.articleId === "string" && row.readers > 0,
    )
    .map((row) => ({ articleId: row.articleId, readers: row.readers }))
    .sort((left, right) => right.readers - left.readers);

  const totalReaders = entries.reduce((sum, entry) => sum + entry.readers, 0);

  if (totalReaders < minimum || entries.length < 3) {
    return { entries: [], periodHours, insufficientData: true };
  }

  return {
    entries: entries.slice(0, limit),
    periodHours,
    insufficientData: false,
  };
}

/** Human-readable period, for the label beside the ranking. */
export function describePeriod(periodHours: number): string {
  if (periodHours % 24 === 0) {
    const days = periodHours / 24;
    return days === 1 ? "past 24 hours" : `past ${days} days`;
  }
  return `past ${periodHours} hours`;
}
