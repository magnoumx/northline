import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AutonomousTopicNotReportableError } from "../../lib/editorial/autonomous-newsroom";

const flat = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8").replace(/\s+/gu, " ");

// 177 runs in two weeks ended "not reportable" after a paid live-search call,
// and every one was recorded at $0, so the dashboard under-reported AI spend.
describe("cost of a run ruled out by live search", () => {
  it("travels on the error", () => {
    const error = new AutonomousTopicNotReportableError("no primary source", 0.012);
    expect(error.costUsd).toBe(0.012);
    expect(new AutonomousTopicNotReportableError("x").costUsd).toBe(0);
  });

  it("is passed when the topic is ruled out", () => {
    expect(flat("../../lib/editorial/autonomous-newsroom.ts")).toContain(
      "which is not enough for a verifiable story.`, discoveryCost, );",
    );
  });

  it("is written to the failed run without lowering a recorded cost", () => {
    const executors = flat("../../lib/jobs/executors.ts");
    expect(executors).toContain("cost_micros=MAX(cost_micros, ?5) WHERE id=?4");
    expect(executors).toContain("Math.round(error.costUsd * 1_000_000)");
  });
});
