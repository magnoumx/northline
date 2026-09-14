/**
 * The Intelligence overview, built from the database.
 *
 * The newsroom's Intelligence pages rendered a fixture view model in
 * production - 120 fictional records with invented publishers, audience totals
 * and rankings. An operator could not tell which numbers were real, and none of
 * them were. That is the first thing the product brief forbids.
 *
 * Every figure below is a count of something that exists. Where a measurement
 * has not been taken yet the field is null and the surface must say so, rather
 * than substituting a plausible number.
 */

export type LiveOverview = {
  /** Window these figures cover, in hours. */
  periodHours: number;
  publishing: {
    published: number;
    approved: number;
    awaitingHumanReview: number;
    drafting: number;
    averageWordCount: number | null;
  };
  sourcing: {
    linkedSources: number;
    primarySources: number;
    /** Share of citations that are primary. Null when nothing is cited yet. */
    primaryShare: number | null;
    articlesWithoutPrimary: number;
  };
  media: {
    articlesWithLicensedHero: number;
    articlesWithoutHero: number;
  };
  audio: {
    ready: number;
    pending: number;
    failed: number;
  };
  cost: {
    /** Recorded spend for the window, in USD. */
    spentUsd: number;
    dailyCeilingUsd: number | null;
  };
  audience: {
    /** Null until first-party analytics has collected anything. */
    measuredReaders: number | null;
  };
};

export type OverviewCounts = {
  articlesByState: Record<string, number>;
  averageWordCount: number | null;
  linkedSources: number;
  primarySources: number;
  articlesWithoutPrimary: number;
  articlesWithLicensedHero: number;
  publishedTotal: number;
  audioReady: number;
  audioPending: number;
  audioFailed: number;
  costMicros: number;
  dailyCeilingUsd: number | null;
  measuredReaders: number | null;
};

/**
 * Shapes raw counts into the overview. Kept pure so the arithmetic - especially
 * the ratios, which are the easiest place to quietly invent a number - is
 * testable without a database.
 */
export function buildLiveOverview(
  counts: OverviewCounts,
  periodHours = 24,
): LiveOverview {
  const state = (name: string) => counts.articlesByState[name] ?? 0;

  return {
    periodHours,
    publishing: {
      published: state("PUBLISHED"),
      approved: state("APPROVED"),
      awaitingHumanReview: state("HUMAN_REVIEW_REQUIRED"),
      drafting: state("DRAFTING"),
      averageWordCount: counts.averageWordCount,
    },
    sourcing: {
      linkedSources: counts.linkedSources,
      primarySources: counts.primarySources,
      // A ratio with no denominator is not zero, it is unknown.
      primaryShare:
        counts.linkedSources > 0
          ? counts.primarySources / counts.linkedSources
          : null,
      articlesWithoutPrimary: counts.articlesWithoutPrimary,
    },
    media: {
      articlesWithLicensedHero: counts.articlesWithLicensedHero,
      articlesWithoutHero: Math.max(
        0,
        counts.publishedTotal - counts.articlesWithLicensedHero,
      ),
    },
    audio: {
      ready: counts.audioReady,
      pending: counts.audioPending,
      failed: counts.audioFailed,
    },
    cost: {
      spentUsd: Math.round((counts.costMicros / 1_000_000) * 100) / 100,
      dailyCeilingUsd: counts.dailyCeilingUsd,
    },
    audience: {
      measuredReaders: counts.measuredReaders,
    },
  };
}

/** Formats a ratio for display, or says it is not measured yet. */
export function formatShare(value: number | null): string {
  if (value === null) return "Not measured";
  return `${Math.round(value * 100)}%`;
}
