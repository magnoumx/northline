import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AutonomousTopicNotReportableError } from "../../lib/editorial/autonomous-newsroom";

const flat = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8").replace(
    /\s+/gu,
    " ",
  );
const executors = flat("lib/jobs/executors.ts");
const newsroom = flat("lib/editorial/autonomous-newsroom.ts");

// primary_source_availability was a literal 0 in the ingestion INSERT and was
// never updated: all 265 trends that reached a story run in two weeks had 0,
// whether live search later found primary sources or not. It could not be
// used for anything until it carried a measurement.
describe("primary-source availability comes from a measurement", () => {
  it("travels on the not-reportable error", () => {
    const error = new AutonomousTopicNotReportableError("none", 0.01, {
      leads: 4,
      primaryLeads: 0,
    });
    expect(error.discovery).toEqual({ leads: 4, primaryLeads: 0 });
    expect(new AutonomousTopicNotReportableError("none").discovery).toBeNull();
  });

  it("is captured where live search counts the leads", () => {
    expect(newsroom).toContain("discoveryCounts = { leads: leads.length, primaryLeads };");
    expect(newsroom).toContain("discoveryCost, discoveryCounts, );");
    // Both successful outcomes report it too.
    expect(newsroom.split("discovery: discoveryCounts,").length - 1).toBe(2);
  });

  it("is written back to the trend for both outcomes, by primary key", () => {
    expect(executors).toContain(
      "UPDATE trends SET primary_source_availability=?2 WHERE id=?1",
    );
    expect(executors).toContain(
      'recordTrendDiscovery(db, trendId, result.discovery, "reportable")',
    );
    expect(executors).toContain(
      'recordTrendDiscovery(db, trendId, error.discovery, "not_reportable")',
    );
  });

  it("records where the number came from", () => {
    expect(executors).toContain('measuredBy: "live_source_discovery"');
  });

  it("is not turned into a publication gate", () => {
    // Until enough measured history exists, the value only feeds the existing
    // small score term; no threshold on it rejects a trend.
    expect(executors).not.toMatch(/primary_source_availability\s*(>=|>|<|<=|=)\s*\d/u);
  });
});
