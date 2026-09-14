import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("components/home-page.tsx", "utf8");

describe("homepage ad placement", () => {
  it("sits between the latest river and the first section shelf", () => {
    const riverIndex = source.indexOf("<HomeRiver");
    const adIndex = source.indexOf("<RestrainedAdPlacement");
    const sectionsIndex = source.indexOf("sections.map(");
    expect(riverIndex).not.toBe(-1);
    expect(adIndex).not.toBe(-1);
    expect(sectionsIndex).not.toBe(-1);
    expect(riverIndex).toBeLessThan(adIndex);
    expect(adIndex).toBeLessThan(sectionsIndex);
  });
});
