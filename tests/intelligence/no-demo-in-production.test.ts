import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");

const overview = read("app/newsroom/intelligence/page.tsx");
const subView = read("app/newsroom/intelligence/[view]/page.tsx");

describe("intelligence never shows fixtures in production", () => {
  it("gates every fixture render behind a non-database mode", () => {
    // These routes rendered 120 fictional records - invented publishers,
    // audience totals and rankings - with nothing on screen to say so.
    for (const [name, source] of [
      ["overview", overview],
      ["sub-view", subView],
    ] as const) {
      const demoAt = source.indexOf("buildIntelligenceDemoViewModel()");
      const guardAt = source.indexOf('resolveContentMode() === "DATABASE"');
      expect(demoAt, name).toBeGreaterThan(-1);
      expect(guardAt, name).toBeGreaterThan(-1);
      // The production guard has to be reached before any fixture render.
      expect(guardAt, name).toBeLessThan(demoAt);
    }
  });

  it("shows an honest empty state instead of invented numbers", () => {
    expect(subView).toContain("<IntelligenceUnavailable");
    expect(overview).toContain("<IntelligenceUnavailable");
  });

  it("states what each view still needs", () => {
    // An operator should learn why a number is missing, not just that it is.
    expect(subView).toContain("REQUIREMENTS");
    expect(subView).toContain("first-party analytics");
    expect(subView).toContain("requires a real experiment system");
  });

  it("does not treat a database failure as a cue to show fixtures", () => {
    // Database mode with no data is an outage, not a demo.
    expect(overview).toContain(
      "The newsroom database returned no workspace data",
    );
  });
});
