import { describe, expect, it } from "vitest";
import {
  buildHighSignalArticleSample,
  buildIntelligenceDemoViewModel,
  buildTrendSnapshot,
  generateHeadlineCandidates,
  recommendFormat,
  scoreOpportunity,
  suggestInternalLinks,
  toPublicOpportunity,
} from "../../lib/intelligence";

describe("high-signal article sample", () => {
  it("contains at least 100 explicitly synthetic derived-metadata records", () => {
    const sample = buildHighSignalArticleSample();

    expect(sample).toHaveLength(120);
    expect(
      sample.every(
        (record) => record.provenance === "SYNTHETIC_DERIVED_METADATA",
      ),
    ).toBe(true);
    expect(
      sample.every(
        (record) =>
          !("body" in record) &&
          !("traffic" in record) &&
          !("searchVolume" in record),
      ),
    ).toBe(true);
    expect(sample[0]).toMatchObject({
      country: "United States",
      language: "English",
      publicEngagementSignals: [
        { metric: "FIXTURE_RELATIVE_ATTENTION_INDEX" },
      ],
    });
    expect(sample[0].knownMetricLimitations.join(" ")).toContain(
      "not observed traffic",
    );
  });

  it("keeps every external collection adapter disabled until configured", () => {
    const model = buildIntelligenceDemoViewModel();

    expect(model.connectors).toHaveLength(13);
    expect(model.connectors.every((item) => item.status === "NOT_CONFIGURED")).toBe(
      true,
    );
    expect(
      new Set(model.connectors.map((item) => item.connectorType)),
    ).toHaveProperty("size", 13);
  });
});

describe("trend intelligence", () => {
  it("defaults to the United States and a 24-hour normalized fixture index", () => {
    const snapshot = buildTrendSnapshot();

    expect(snapshot.country).toBe("US");
    expect(snapshot.window).toBe("24h");
    expect(snapshot.metric).toBe("RELATIVE_SEARCH_INTEREST");
    expect(snapshot.metricDefinition).toContain("not absolute");
    expect(
      snapshot.signals.every(
        (signal) =>
          signal.relativeSearchInterest >= 0 &&
          signal.relativeSearchInterest <= 100 &&
          signal.estimatedMonthlySearches === null,
      ),
    ).toBe(true);
  });

  it("builds every required country and time-window fixture", () => {
    const model = buildIntelligenceDemoViewModel();
    const windows = ["4h", "12h", "24h", "7d", "30d", "12mo", "custom"];

    expect(Object.keys(model.trendSnapshots)).toEqual([
      "US",
      "CA",
      "GB",
      "AU",
    ]);
    expect(Object.keys(model.trendSnapshots.US)).toEqual(windows);
  });
});

describe("story opportunity engine", () => {
  it("rejects high-risk, weakly evidenced claims with human-readable reasons", () => {
    const opportunity = scoreOpportunity({
      id: "unsafe",
      topic: "Unverified claim",
      searchMomentum: 95,
      unitedStatesRelevance: 85,
      newsImportance: 70,
      sourceStrength: 18,
      originalValueOpportunity: 60,
      visualPotential: 50,
      videoPotential: 40,
      readerUtility: 78,
      existingSiteAuthority: 20,
      commercialSuitability: 20,
      freshness: 90,
      expectedLifespan: 20,
      updatePotential: 90,
      competitionPenalty: 60,
      verificationDifficultyPenalty: 90,
      legalRiskPenalty: 90,
      copyrightRiskPenalty: 80,
      duplicateRiskPenalty: 75,
      sensationalismRiskPenalty: 90,
      sourceFamilies: 1,
      evolving: true,
      existingCoverage: false,
    });

    expect(opportunity.state).toBe("REJECT");
    expect(opportunity.reasons.length).toBeGreaterThan(1);
    expect(opportunity.cautions.join(" ")).toContain("human verification");
  });

  it("removes protected scoring and rationale from a public projection", () => {
    const internal = buildIntelligenceDemoViewModel().opportunities[0];
    const projected = toPublicOpportunity(internal);

    expect(projected).not.toHaveProperty("internalScore");
    expect(projected).not.toHaveProperty("reasons");
    expect(projected).not.toHaveProperty("cautions");
    expect(projected).not.toHaveProperty("disclosure");
  });
});

describe("adaptive article depth", () => {
  it("selects a narrow news flash without encouraging padding", () => {
    const recommendation = recommendFormat({
      urgency: "HIGH",
      evidenceCount: 1,
      eventCount: 1,
      publicActionability: false,
      analyticalDepth: false,
      evolving: false,
    });

    expect(recommendation.format).toBe("NEWS_FLASH");
    expect(recommendation.targetWords?.[1]).toBe(300);
    expect(recommendation.noPaddingRule.toLowerCase()).toContain("verified");
  });

  it("selects an ultimate guide only when actionability has a broad evidence set", () => {
    expect(
      recommendFormat({
        urgency: "MEDIUM",
        evidenceCount: 14,
        eventCount: 6,
        publicActionability: true,
        analyticalDepth: false,
        evolving: false,
      }).format,
    ).toBe("ULTIMATE_GUIDE");
  });

  it("exposes the six required depth formats with exact guardrail ranges", () => {
    const formats = buildIntelligenceDemoViewModel().formats;

    expect(formats.map((item) => item.format)).toEqual([
      "NEWS_FLASH",
      "QUICK_BRIEF",
      "STANDARD_STORY",
      "DEEP_EXPLAINER",
      "ULTIMATE_GUIDE",
      "LIVE_COVERAGE",
    ]);
    expect(formats[0].targetWords).toEqual([150, 300]);
    expect(formats[4].targetWords).toEqual([3000, 6000]);
    expect(formats[5].targetWords).toBeNull();
  });
});

describe("headline intelligence lab", () => {
  const headlines = generateHeadlineCandidates({
    subject: "Regional utility commission",
    verifiedAction: "outlines a grid resilience proposal",
    readerImpact: "household reliability planning",
    location: "Northline Metro",
    timing: "July planning update",
  });

  it("produces 24 varied candidates for a major-story exercise", () => {
    expect(headlines).toHaveLength(24);
    expect(new Set(headlines.map((headline) => headline.text)).size).toBe(24);
    expect(new Set(headlines.map((headline) => headline.strategy)).size).toBe(6);
  });

  it("hard-rejects a candidate whose question framing can outrun reporting", () => {
    expect(
      headlines.some(
        (headline) =>
          headline.hardRejectReason?.includes("reporting has not established"),
      ),
    ).toBe(true);
  });
});

describe("knowledge graph suggestions", () => {
  it("uses shared explicit entities and respects the density cap", () => {
    const model = buildIntelligenceDemoViewModel();
    const suggestions = suggestInternalLinks({
      sourceStory: model.stories[0],
      candidateStories: model.stories,
      entities: model.entities,
      sourceWordCount: 500,
    });

    expect(suggestions.length).toBeLessThanOrEqual(3);
    expect(
      suggestions.every(
        (suggestion) =>
          suggestion.sharedEntityIds.length > 0 &&
          suggestion.insertionContext.includes("first useful mention"),
      ),
    ).toBe(true);
  });
});
