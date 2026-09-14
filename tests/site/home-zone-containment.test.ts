import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const zonesSource = readFileSync("components/home/home-zones.tsx", "utf8");
const homeCss = readFileSync("styles/home.css", "utf8");

/**
 * Every top-level homepage zone must be inside the shared width constraint.
 *
 * `.home-section` shipped without it and without any styles at all. Nothing
 * caught it: a full-bleed element is exactly as wide as the viewport, so it
 * produces no horizontal overflow, and the local fixture data has too few
 * stories per category for the section to render at all. It only appeared on
 * production, where a single lead photograph was drawn 1975px wide and 1234px
 * tall - taller than the screen.
 *
 * This test reads the constraint straight out of the stylesheet and checks it
 * against the zones the component actually renders, so a new zone cannot be
 * added without one.
 */
function constrainedSelectors(): Set<string> {
  const rule = /((?:^\.[a-z-]+,\s*\n)+^\.[a-z-]+)\s*\{\s*\n\s*width: min\(/m.exec(
    homeCss,
  );
  if (!rule) throw new Error("width-constraint rule not found in styles/home.css");
  return new Set(
    rule[1]
      .split(",")
      .map((selector) => selector.trim().replace(/^\./, ""))
      .filter(Boolean),
  );
}

/** Top-level element class of each exported zone, in render order. */
const TOP_LEVEL_ZONE_CLASSES = [
  "front",
  "river",
  "home-section",
  "trend-strip",
  "invite",
  "home-ad-placement",
  "home-empty",
];

describe("homepage zone containment", () => {
  it("constrains every top-level zone to the shared container width", () => {
    const constrained = constrainedSelectors();
    for (const zone of TOP_LEVEL_ZONE_CLASSES) {
      expect(
        constrained.has(zone),
        `.${zone} is rendered as a top-level homepage zone but is missing from the width-constraint rule in styles/home.css, so it will render full-bleed`,
      ).toBe(true);
    }
  });

  it("covers every zone class the component actually renders", () => {
    // Guards the list above from drifting out of date when a zone is added.
    const rendered = [
      ...zonesSource.matchAll(/<section className="([a-z-]+)"/g),
    ].map((match) => match[1]);
    for (const zone of rendered) {
      expect(
        TOP_LEVEL_ZONE_CLASSES,
        `home-zones.tsx renders <section className="${zone}"> but this test does not check it`,
      ).toContain(zone);
    }
    expect(rendered.length).toBeGreaterThan(0);
  });

  it("gives the section shelf a real grid so its image is bounded by a column", () => {
    expect(homeCss).toContain(".home-section__grid");
    expect(homeCss).toMatch(/\.home-section__grid\s*\{[\s\S]*?display: grid/);
    // Without a column the lead image is sized by the viewport, which is the
    // failure that reached production.
    expect(homeCss).toMatch(
      /\.home-section__grid\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1\.6fr\) minmax\(0, 1fr\)/,
    );
  });
});
