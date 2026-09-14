import { describe, expect, it } from "vitest";
import {
  canEnableLimitedAutomation,
  evaluateCandidate,
  publicationCapacity,
} from "../../lib/editorial/candidate-selection";

describe("V2 editorial candidate selection", () => {
  it("combines audience demand, evidence, originality, safety, cost, and lifespan", () => {
    const result = evaluateCandidate({
      usSearchDemand: 0.9,
      newsImportance: 1,
      sourceAvailability: 1,
      originalValueOpportunity: 0.8,
      visualAvailability: 0.7,
      advertiserSafety: 0.8,
      audienceFit: 0.9,
      existingSiteAuthority: 0.6,
      duplicateRisk: 0.1,
      legalRisk: 0.1,
      productionCost: 0.3,
      expectedArticleLifespan: 0.8,
    });
    expect(result.recommendation).toBe("PRIORITIZE");
    expect(result.explanation).toHaveLength(12);
  });

  it("holds a popular topic with weak sources or severe legal risk", () => {
    const result = evaluateCandidate({
      usSearchDemand: 1,
      newsImportance: 1,
      sourceAvailability: 0.3,
      originalValueOpportunity: 1,
      visualAvailability: 1,
      advertiserSafety: 1,
      audienceFit: 1,
      existingSiteAuthority: 1,
      duplicateRisk: 0,
      legalRisk: 0.9,
      productionCost: 0,
      expectedArticleLifespan: 1,
    });
    expect(result.recommendation).toBe("HOLD");
  });

  it("has no forced minimum and enforces normal/exceptional caps", () => {
    expect(publicationCapacity({ exceptionalNewsDay: false, alreadyPublished: 2 })).toEqual({
      remaining: 3,
      forcedMinimum: 0,
      cap: 5,
    });
    expect(publicationCapacity({ exceptionalNewsDay: true, alreadyPublished: 9 }).remaining).toBe(1);
  });

  it("requires every shadow-mode safety gate before limited automation", () => {
    const ready = {
      shadowDays: 30,
      unresolvedCriticalSourcingFailures: 0,
      unresolvedCriticalCopyrightFailures: 0,
      unresolvedCriticalSecurityFailures: 0,
      categoryAllowed: true,
      killSwitchTested: true,
      correctionDrillCompleted: true,
      maximumDailyCap: 5,
    };
    expect(canEnableLimitedAutomation(ready)).toBe(true);
    expect(canEnableLimitedAutomation({ ...ready, shadowDays: 29 })).toBe(false);
    expect(
      canEnableLimitedAutomation({
        ...ready,
        unresolvedCriticalSourcingFailures: 1,
      }),
    ).toBe(false);
  });
});

