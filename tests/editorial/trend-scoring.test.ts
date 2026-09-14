import { describe, expect, it } from "vitest";

import {
  scoreTrend,
  type TrendScoringInput,
} from "../../lib/editorial/trend-scoring";

function signal(value: number, explanation: string) {
  return { value, explanation };
}

function scoringInput(): TrendScoringInput {
  return {
    contributions: {
      usSearchDemand: signal(1, "US query growth is sustained across two windows."),
      freshnessAndVelocity: signal(1, "The event changed within the last hour."),
      newsImportance: signal(1, "The development materially affects readers."),
      sourceConfidence: signal(1, "Primary evidence and two newsrooms agree."),
      originalValueOpportunity: signal(1, "A source comparison and timeline are available."),
      audienceRelevance: signal(1, "The event has a clear US reader impact."),
      visualPotential: signal(1, "Rights-cleared primary charts are available."),
      commercialSuitability: signal(1, "The topic is suitable for general advertising."),
      followUpPotential: signal(1, "A dated follow-up milestone is known."),
    },
    penalties: {
      legalAndReputationRisk: signal(0.5, "A named organization disputes one detail."),
      weakVerification: signal(0.1, "One secondary detail remains partially verified."),
      duplicateCoverage: signal(0.5, "A related brief already exists."),
      copyrightRisk: signal(0, "Only licensed or original material is planned."),
      sensationalismRisk: signal(0, "The framing is factual and proportionate."),
    },
  };
}

describe("trend scoring", () => {
  it("returns an auditable contribution and penalty breakdown", () => {
    const result = scoreTrend(scoringInput());

    expect(result.contributionSubtotal).toBe(100);
    expect(result.penaltySubtotal).toBe(28);
    expect(result.rawScore).toBe(72);
    expect(result.score).toBe(72);
    expect(result.contributions).toHaveLength(9);
    expect(result.penalties).toHaveLength(5);
    expect(result.explanation.some((line) => line.includes("removed"))).toBe(
      true,
    );
  });

  it("floors heavily penalized results at zero while retaining the raw score", () => {
    const input = scoringInput();
    const result = scoreTrend({
      contributions: {
        usSearchDemand: signal(0, input.contributions.usSearchDemand.explanation),
        freshnessAndVelocity: signal(
          0,
          input.contributions.freshnessAndVelocity.explanation,
        ),
        newsImportance: signal(0, input.contributions.newsImportance.explanation),
        sourceConfidence: signal(
          0,
          input.contributions.sourceConfidence.explanation,
        ),
        originalValueOpportunity: signal(
          0,
          input.contributions.originalValueOpportunity.explanation,
        ),
        audienceRelevance: signal(
          0,
          input.contributions.audienceRelevance.explanation,
        ),
        visualPotential: signal(
          0,
          input.contributions.visualPotential.explanation,
        ),
        commercialSuitability: signal(
          0,
          input.contributions.commercialSuitability.explanation,
        ),
        followUpPotential: signal(
          0,
          input.contributions.followUpPotential.explanation,
        ),
      },
      penalties: {
        legalAndReputationRisk: signal(
          1,
          input.penalties.legalAndReputationRisk.explanation,
        ),
        weakVerification: signal(
          1,
          input.penalties.weakVerification.explanation,
        ),
        duplicateCoverage: signal(
          1,
          input.penalties.duplicateCoverage.explanation,
        ),
        copyrightRisk: signal(1, input.penalties.copyrightRisk.explanation),
        sensationalismRisk: signal(
          1,
          input.penalties.sensationalismRisk.explanation,
        ),
      },
    });

    expect(result.rawScore).toBeLessThan(0);
    expect(result.score).toBe(0);
  });

  it("rejects unexplained and out-of-range inputs", () => {
    const input = scoringInput();
    expect(() =>
      scoreTrend({
        ...input,
        contributions: {
          ...input.contributions,
          usSearchDemand: signal(1.1, "Invalid normalized value."),
        },
      }),
    ).toThrow(RangeError);
    expect(() =>
      scoreTrend({
        ...input,
        penalties: {
          ...input.penalties,
          copyrightRisk: signal(0.2, "  "),
        },
      }),
    ).toThrow(TypeError);
  });
});
