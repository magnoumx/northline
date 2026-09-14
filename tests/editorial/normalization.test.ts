import { describe, expect, it } from "vitest";

import {
  compareTrendCandidates,
  detectTrendDuplicates,
  normalizeTrendTerm,
} from "../../lib/editorial/normalization";

describe("trend normalization", () => {
  it("normalizes Unicode, possessives, punctuation, and whitespace", () => {
    expect(normalizeTrendTerm("  Beyoncé’s  AI—Launch! ")).toBe(
      "beyonce ai launch",
    );
  });

  it("resolves normalized alias chains without looping on cycles", () => {
    expect(
      normalizeTrendTerm("A.I.", {
        aliases: {
          "a i": "AI",
          AI: "artificial intelligence",
        },
      }),
    ).toBe("artificial intelligence");

    expect(
      normalizeTrendTerm("first", {
        aliases: { first: "second", second: "first" },
      }),
    ).toBe("first");
  });
});

describe("duplicate detection", () => {
  it("detects reordered, inflected terms as near duplicates", () => {
    const result = compareTrendCandidates(
      {
        id: "candidate",
        originalTerm: "Aster Loop releases new translation earbuds",
        entityIds: ["aster-loop", "luma-one"],
      },
      {
        id: "existing",
        originalTerm: "New translation earbuds released by Aster Loop",
        entityIds: ["aster-loop", "luma-one"],
      },
    );

    expect(result.decision).toBe("NEAR_DUPLICATE");
    expect(result.lexicalSimilarity).toBe(1);
    expect(result.sharedEntityIds).toEqual(["aster-loop", "luma-one"]);
    expect(result.reasons).not.toHaveLength(0);
  });

  it("keeps unrelated events distinct and returns only duplicate matches", () => {
    const candidate = {
      id: "candidate",
      originalTerm: "Harborlight telescope dataset",
      entityIds: ["harborlight"],
    };
    const existing = [
      {
        id: "duplicate",
        originalTerm: "Harborlight telescope data",
        relatedTerms: ["Harborlight telescope dataset"],
        entityIds: ["harborlight"],
      },
      {
        id: "distinct",
        originalTerm: "Metrovale championship result",
        entityIds: ["metrovale-comets"],
      },
    ];

    expect(compareTrendCandidates(candidate, existing[1]).decision).toBe(
      "DISTINCT",
    );
    expect(detectTrendDuplicates(candidate, existing).map((match) => match.existingId)).toEqual([
      "duplicate",
    ]);
  });

  it("rejects invalid duplicate thresholds", () => {
    expect(() =>
      compareTrendCandidates(
        { id: "a", originalTerm: "one" },
        { id: "b", originalTerm: "one" },
        { nearDuplicateThreshold: 1.2, entityWeight: 0.25 },
      ),
    ).toThrow(RangeError);
  });

  it("does not classify two empty signals as duplicate coverage", () => {
    expect(
      compareTrendCandidates(
        { id: "a", originalTerm: " -- " },
        { id: "b", originalTerm: "…" },
      ).decision,
    ).toBe("DISTINCT");
  });
});
