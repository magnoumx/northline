import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { uniqueSourceLinks } from "../../lib/editorial/article-write-service";

const flat = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8").replace(
    /\s+/gu,
    " ",
  );
const executors = flat("lib/jobs/executors.ts");
const schedule = executors.slice(
  executors.indexOf("export async function executeAutonomousDraftSchedule"),
  executors.indexOf("export async function executeAutonomousArticleGenerate"),
);

describe("one link per source per version", () => {
  // 2026-10-29: three finished drafts were lost to "UNIQUE constraint failed:
  // article_source_links.article_version_id, article_source_links.source_id"
  // because two leads from the same outlet resolved to the same source.
  it("drops repeated sources and keeps the first in citation order", () => {
    const links = uniqueSourceLinks([
      { sourceId: "ap", summary: "first AP story" },
      { sourceId: "reuters", summary: "Reuters" },
      { sourceId: "ap", summary: "second AP story" },
    ]);
    expect(links.map((link) => link.summary)).toEqual(["first AP story", "Reuters"]);
  });

  it("is what the version packet writes", () => {
    expect(flat("lib/editorial/article-write-service.ts")).toContain(
      "uniqueSourceLinks(input.sources).forEach((source, index) =>",
    );
  });
});

describe("abandoned runs are recovered even during a provider cooldown", () => {
  // A run whose worker died at 09:48 stayed RUNNING behind the cooldown
  // return, because recovery only ran after the cooldown check.
  it("recovers stale runs before checking the cooldown", () => {
    const recovery = schedule.indexOf("error_code='STALE_RUN_RECOVERED'");
    const cooldown = schedule.indexOf("readAiProviderCooldownUntil(db)");
    expect(recovery).toBeGreaterThan(-1);
    expect(recovery).toBeLessThan(cooldown);
  });
});

describe("stories in one batch do not hit the provider at the same moment", () => {
  // Two consumers run concurrently; both stories of a batch started together
  // and both died on the provider's per-minute limit.
  it("spaces each generate message after the first", () => {
    expect(schedule).toContain("AUTONOMOUS_GENERATE_SPACING_SECONDS");
    expect(schedule).toContain("delaySeconds > 0 ? { delaySeconds } : undefined");
  });

  it("keeps the delay inside the 45-minute stale-run window", () => {
    expect(schedule).toContain("Math.min(position * spacingSeconds, 30 * 60)");
  });
});

describe("the providers behind each finished run are recorded", () => {
  it("stores drafting and review providers and whether the review was independent", () => {
    expect(executors).toContain('recordJobDiagnostic(db, "article.generate", "providers"');
    expect(executors).toContain('result.reviewProvider !== "deterministic"');
  });
});
