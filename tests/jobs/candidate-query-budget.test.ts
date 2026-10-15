import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const executors = readFileSync(
  fileURLToPath(new URL("../../lib/jobs/executors.ts", import.meta.url)),
  "utf8",
).replace(/\s+/gu, " ");

// On 2026-10-15 article.autodraft and opportunity.rescore were both going to the
// dead-letter queue on "D1 DB exceeded its CPU time limit". The candidate query
// scored every recent trend row (a dozen text scans each) and de-duplicated each
// against every run, so a 10k-row table was past the limit and no story ever
// started - which looked like "the bot does not publish".
describe("draft candidate selection stays inside D1's CPU budget", () => {
  it("narrows to a bounded set of fresh trends before per-row scoring", () => {
    const scoring = executors.indexOf("AS priorityScore");
    const from = executors.indexOf("FROM ( SELECT * FROM trends", scoring);
    expect(from).toBeGreaterThan(scoring);
    const prefilter = executors.slice(from, from + 600);
    expect(prefilter).toContain("ORDER BY latest_detected_at DESC");
    expect(prefilter).toMatch(/LIMIT 300 \) t/u);
  });

  it("never prunes the append-only audit log", () => {
    // audit_logs is append-only by trigger; a delete there throws, and the daily
    // hygiene job would fail every run.
    const hygiene = executors.slice(
      executors.indexOf("export async function executeDataHygiene"),
      executors.indexOf("export async function executeApprovedArticleAutopublish"),
    );
    expect(hygiene).not.toContain("DELETE FROM audit_logs");
  });
});
