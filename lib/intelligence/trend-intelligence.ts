import type {
  IntelligenceCountry,
  IntelligenceWindow,
  TrendSignal,
  TrendSnapshot,
} from "./types";

const topicSeeds = [
  ["Local resilience planning", "Climate"],
  ["Public transit reliability", "Infrastructure"],
  ["Consumer price changes", "Economy"],
  ["Primary care access", "Health"],
  ["School funding proposals", "Education"],
  ["Grid modernization", "Energy"],
  ["Small-business lending", "Business"],
  ["Election administration", "Politics"],
  ["Data privacy rules", "Technology"],
  ["Housing permit reform", "Housing"],
  ["Water system investment", "Environment"],
  ["Emergency response staffing", "Public safety"],
] as const;

const windowWeight: Record<IntelligenceWindow, number> = {
  "4h": 7,
  "12h": 11,
  "24h": 17,
  "7d": 23,
  "30d": 29,
  "12mo": 37,
  custom: 41,
};

const countryWeight: Record<IntelligenceCountry, number> = {
  US: 3,
  CA: 13,
  GB: 19,
  AU: 31,
};

const countryRegions: Record<IntelligenceCountry, string> = {
  US: "Multi-region United States fixture",
  CA: "Multi-province Canada fixture",
  GB: "Multi-region United Kingdom fixture",
  AU: "Multi-state Australia fixture",
};

/**
 * Builds a normalized, deterministic demo snapshot. Values describe position
 * inside the fixture sample only; they are not search volume or audience size.
 */
export function buildTrendSnapshot(
  country: IntelligenceCountry = "US",
  window: IntelligenceWindow = "24h",
): TrendSnapshot {
  const seed = countryWeight[country] + windowWeight[window];
  const signals = topicSeeds
    .map(([topic, category], index): TrendSignal => {
      const relativeSearchInterest =
        48 + ((seed * (index + 5) + index * 19) % 49);
      const sourceFamilies = 2 + ((seed + index * 3) % 5);
      return {
        id: `signal-${country.toLowerCase()}-${window}-${index + 1}`,
        topic,
        originalQuery: topic.toLowerCase(),
        country,
        region: countryRegions[country],
        language: "English",
        category,
        relatedEntities: [topic.split(" ")[0], category],
        firstDetectedLabel: `${window} fixture start`,
        lastDetectedLabel: "Frozen July 2026 fixture",
        peakTimeLabel: `Fixture interval ${(index % 4) + 1}`,
        relativeSearchInterest,
        estimatedMonthlySearches: null,
        searchGrowthPercent: ((seed + index * 5) % 61) - 15,
        newsSourceVelocity:
          sourceFamilies >= 5 ? "HIGH" : sourceFamilies >= 3 ? "MEDIUM" : "LOW",
        socialVelocity: "UNKNOWN_NOT_CONNECTED",
        videoVelocity: "UNKNOWN_NOT_CONNECTED",
        wikipediaInterest: "UNKNOWN_NOT_CONNECTED",
        relatedQueries: [`${topic.toLowerCase()} update`, `${topic.toLowerCase()} policy`],
        risingQueries: [`what changed in ${topic.toLowerCase()}`],
        primarySourceAvailability:
          index % 3 === 0 ? "HIGH" : index % 3 === 1 ? "MEDIUM" : "LOW",
        imageAvailability: "UNKNOWN_NOT_REVIEWED",
        videoAvailability: "UNKNOWN_NOT_REVIEWED",
        existingStoryCluster: index % 2 === 0 ? `demo-cluster-${index + 1}` : null,
        existingSiteCoverage:
          index % 3 === 0 ? "CURRENT" : index % 3 === 1 ? "PARTIAL" : "NONE",
        competition: index % 3 === 0 ? "HIGH" : index % 3 === 1 ? "MEDIUM" : "LOW",
        freshness: index < 4 ? "FAST" : index < 8 ? "DAILY" : "EVERGREEN",
        risk: index % 5 === 0 ? "MEDIUM" : "LOW",
        commercialSuitability: "NOT_EVALUATED",
        recommendedFormat:
          index < 2
            ? "QUICK_BRIEF"
            : index < 6
              ? "STANDARD_STORY"
              : "DEEP_EXPLAINER",
        recommendedDeadline:
          index < 4 ? "Review in the current desk cycle" : "Review this week",
        expectedLifespan: index < 4 ? "Hours to days" : "Days to weeks",
        explanation:
          "Visible because several fictional source families show a consistent normalized pattern.",
        metricSource: "SYNTHETIC_V4_FIXTURE",
        metricConfidence: "DEMO_ONLY",
        sourceFamilies,
        provenance:
          "Synthetic derived metadata across configured demo source families",
      };
    })
    .sort(
      (left, right) =>
        right.relativeSearchInterest - left.relativeSearchInterest,
    );

  return {
    country,
    window,
    metric: "RELATIVE_SEARCH_INTEREST",
    metricLabel: "Relative search interest",
    metricDefinition:
      "A normalized 0–100 position within this synthetic fixture. It is not absolute search, traffic, or social volume.",
    generatedAtLabel: "Frozen V4 demo fixture · July 2026",
    provenanceLabel:
      "Synthetic derived metadata · public-source connector shapes · no article bodies",
    signals,
  };
}
