import { describe, expect, it } from "vitest";
import {
  buildLiveOverview,
  formatShare,
  type OverviewCounts,
} from "../../lib/intelligence/live-overview";

const counts: OverviewCounts = {
  articlesByState: {
    PUBLISHED: 20,
    APPROVED: 3,
    HUMAN_REVIEW_REQUIRED: 23,
    DRAFTING: 4,
  },
  averageWordCount: 1120,
  linkedSources: 80,
  primarySources: 20,
  articlesWithoutPrimary: 2,
  articlesWithLicensedHero: 6,
  publishedTotal: 20,
  audioReady: 37,
  audioPending: 13,
  audioFailed: 0,
  costMicros: 1_450_000,
  dailyCeilingUsd: 10,
  measuredReaders: null,
};

describe("live overview", () => {
  it("reports counts that exist rather than fixtures", () => {
    const overview = buildLiveOverview(counts);
    expect(overview.publishing.published).toBe(20);
    expect(overview.publishing.awaitingHumanReview).toBe(23);
    expect(overview.audio.ready).toBe(37);
  });

  it("says a ratio is unknown instead of calling it zero", () => {
    // An empty denominator is not a 0% primary-source rate; it is no data.
    const overview = buildLiveOverview({
      ...counts,
      linkedSources: 0,
      primarySources: 0,
    });
    expect(overview.sourcing.primaryShare).toBeNull();
    expect(formatShare(overview.sourcing.primaryShare)).toBe("Not measured");
  });

  it("computes the primary-source share when there is a denominator", () => {
    expect(buildLiveOverview(counts).sourcing.primaryShare).toBeCloseTo(0.25);
    expect(formatShare(0.25)).toBe("25%");
  });

  it("leaves audience null until analytics has measured something", () => {
    // Substituting a plausible audience number is exactly the fixture problem.
    expect(buildLiveOverview(counts).audience.measuredReaders).toBeNull();
    expect(
      buildLiveOverview({ ...counts, measuredReaders: 412 }).audience
        .measuredReaders,
    ).toBe(412);
  });

  it("reports spend in dollars from recorded micros", () => {
    expect(buildLiveOverview(counts).cost.spentUsd).toBe(1.45);
  });

  it("never reports negative media coverage", () => {
    const overview = buildLiveOverview({
      ...counts,
      articlesWithLicensedHero: 25,
      publishedTotal: 20,
    });
    expect(overview.media.articlesWithoutHero).toBe(0);
  });

  it("treats an unseen state as zero, not as missing", () => {
    const overview = buildLiveOverview({ ...counts, articlesByState: {} });
    expect(overview.publishing.published).toBe(0);
    expect(overview.publishing.drafting).toBe(0);
  });
});
