import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("components/home-page.tsx", "utf8");

describe("homepage density", () => {
  it("shows 9 latest stories in the river, up from the old 6", () => {
    expect(source).toMatch(/LATEST_ZONE_SIZE = 9;/);
  });

  it("displays more than a qualifying section's 3-story minimum", () => {
    expect(source).toMatch(/SECTION_DISPLAY_COUNT = 5;/);
    expect(source).toMatch(/MINIMUM_SECTION_STORIES = 3;/);
    // The take-count used to build a section's stories must be the display
    // count, not the minimum-to-qualify gate - conflating them would mean
    // raising density also raises the bar for a quiet section to appear at all.
    expect(source).toMatch(
      /take\(\s*stories\.filter\(\(story\) => story\.category === section\.category\),\s*SECTION_DISPLAY_COUNT,?\s*\)/,
    );
  });
});
