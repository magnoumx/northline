import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type EvaluationCase = {
  id: string;
  category: string;
  prompt: string;
  traps: string[];
  mustInclude: string[];
  mustNotClaim: string[];
};

describe("blind AI evaluation set", () => {
  const file = resolve(process.cwd(), "tests/ai/fixtures/eval-cases.json");
  const cases = JSON.parse(readFileSync(file, "utf8")) as EvaluationCase[];

  it("contains at least 50 unique, adjudicable tasks", () => {
    expect(cases.length).toBeGreaterThanOrEqual(50);
    expect(new Set(cases.map((entry) => entry.id)).size).toBe(cases.length);
    for (const entry of cases) {
      expect(entry.prompt.length).toBeGreaterThan(20);
      expect(entry.traps.length).toBeGreaterThan(0);
      expect(entry.mustInclude.length).toBeGreaterThan(0);
      expect(entry.mustNotClaim.length).toBeGreaterThan(0);
    }
  });

  it("covers every launch evaluation family", () => {
    const categories = new Set(cases.map((entry) => entry.category));
    for (const required of [
      "breaking_announcement",
      "technology_launch",
      "sports_result",
      "entertainment",
      "company_earnings",
      "science_paper",
      "conflicting_reports",
      "fake_viral_claim",
      "corrected_report",
      "sensitive_allegation",
      "date_number_trap",
      "quote_attribution",
      "search_explainer",
    ]) {
      expect(categories).toContain(required);
    }
  });
});
