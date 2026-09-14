import { describe, expect, it } from "vitest";
import {
  describePeriod,
  MINIMUM_READERS_TO_RANK,
  rankMostRead,
} from "../../lib/content/most-read";

const measured = [
  { articleId: "article_a", readers: 40 },
  { articleId: "article_b", readers: 25 },
  { articleId: "article_c", readers: 10 },
  { articleId: "article_d", readers: 4 },
];

describe("most read", () => {
  it("ranks by measured readers", () => {
    const result = rankMostRead(measured);
    expect(result.insufficientData).toBe(false);
    expect(result.entries.map((entry) => entry.articleId)).toEqual([
      "article_a",
      "article_b",
      "article_c",
      "article_d",
    ]);
  });

  it("declines to rank when too little was measured", () => {
    // A new publication sits here for a while. The honest answer is no
    // ranking, not the newest five relabelled as the most read.
    const result = rankMostRead([
      { articleId: "article_a", readers: 3 },
      { articleId: "article_b", readers: 1 },
    ]);
    expect(result.insufficientData).toBe(true);
    expect(result.entries).toEqual([]);
  });

  it("declines when a single article dominates a tiny sample", () => {
    // Enough total readers, but only two articles measured: that ranks the
    // sample, not the publication.
    const result = rankMostRead([
      { articleId: "article_a", readers: 60 },
      { articleId: "article_b", readers: 2 },
    ]);
    expect(result.insufficientData).toBe(true);
  });

  it("always returns the period the ranking covers", () => {
    // "Most read" with no time range is a claim nobody can check.
    expect(rankMostRead(measured).periodHours).toBe(48);
    expect(rankMostRead(measured, { periodHours: 24 }).periodHours).toBe(24);
  });

  it("ignores rows with no article", () => {
    const result = rankMostRead([
      ...measured,
      { articleId: null, readers: 999 },
    ]);
    expect(result.entries.every((entry) => entry.articleId)).toBe(true);
    expect(result.entries.some((entry) => entry.readers === 999)).toBe(false);
  });

  it("respects the requested size", () => {
    expect(rankMostRead(measured, { limit: 2 }).entries).toHaveLength(2);
  });

  it("states a floor that a real publication has to clear", () => {
    expect(MINIMUM_READERS_TO_RANK).toBeGreaterThanOrEqual(20);
  });
});

describe("period label", () => {
  it("reads naturally", () => {
    expect(describePeriod(24)).toBe("past 24 hours");
    expect(describePeriod(48)).toBe("past 2 days");
    expect(describePeriod(6)).toBe("past 6 hours");
  });
});
