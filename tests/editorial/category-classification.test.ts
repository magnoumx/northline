import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

const newsroom = read("../../lib/editorial/autonomous-newsroom.ts");
const flat = newsroom.replace(/\s+/gu, " ");
const gateway = read("../../lib/ai/editorial-gateway.ts");

describe("category classification only runs where the keyword list gives up", () => {
  it("keeps the free keyword list as the first pass", () => {
    // categorizeByKeyword is regex over a fixed word list, so "Andrey Rublev
    // Reclaims ATP Title" - no word in the list - fell through to US_NEWS
    // with nothing left to correct it. The list still runs first because it
    // costs nothing; the model call is reserved for the case it could not
    // resolve, which is where a wrong sports-into-US_NEWS filing actually
    // came from.
    expect(flat).toContain(
      "const heuristicCategory = inferAutonomousCategory(input.headline, input.category);",
    );
  });

  it("only spends on classification when the heuristic landed on US_NEWS", () => {
    expect(flat).toContain('heuristicCategory === "US_NEWS" ? await classifyStoryCategory');
  });

  it("never lets a classification failure block or throw out of drafting", () => {
    const fn = newsroom.slice(newsroom.indexOf("async function classifyStoryCategory"));
    const body = fn.slice(0, fn.indexOf("\nfunction inferAutonomousCategory"));
    expect(body).toContain("try {");
    expect(body).toContain("} catch (error) {");
    expect(body).toContain('return "US_NEWS";');
  });

  it("requires real confidence before trusting the model's answer", () => {
    const fn = newsroom.slice(
      newsroom.indexOf("async function classifyStoryCategory"),
      newsroom.indexOf("function inferAutonomousCategory"),
    );
    expect(fn).toContain("result.data.confidence >= 0.6");
    expect(fn).toContain("STORY_CATEGORIES");
  });

  it("bounds the cost of the classification call", () => {
    const fn = newsroom.slice(
      newsroom.indexOf("async function classifyStoryCategory"),
      newsroom.indexOf("function inferAutonomousCategory"),
    );
    expect(fn).toMatch(/maxCostUsd:\s*0\.01/u);
  });
});

describe("the classification prompt names the real category enum", () => {
  // "classification:" also names an unrelated routing-table key earlier in
  // this file, so the search starts from the policies map inside
  // systemTemplate(), not from the first occurrence in the file.
  const policiesMap = gateway.slice(gateway.indexOf("function systemTemplate"));

  it("lists every valid StoryCategory value, not a freeform guess", () => {
    const policy = policiesMap.slice(
      policiesMap.indexOf("classification:"),
      policiesMap.indexOf("\"live-source-discovery\":"),
    );
    for (const category of [
      "US_NEWS", "POLITICS", "TECHNOLOGY", "BUSINESS", "ENTERTAINMENT",
      "SPORTS", "GAMING", "SCIENCE", "INTERNET_TRENDS", "WORLD", "HEALTH",
      "FINANCE", "WEATHER",
    ]) {
      expect(policy, category).toContain(category);
    }
  });

  it("asks for general knowledge, not literal keyword matching", () => {
    const policy = policiesMap.slice(
      policiesMap.indexOf("classification:"),
      policiesMap.indexOf("\"live-source-discovery\":"),
    );
    expect(policy.toLowerCase()).toContain("general knowledge");
  });
});
