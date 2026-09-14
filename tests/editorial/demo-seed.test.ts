import { describe, expect, it } from "vitest";

import {
  DEMO_CONTENT_DISCLAIMER,
  DEMO_ENTITIES,
  DEMO_SOURCES,
  DEMO_STORIES,
  DEMO_TRENDS,
} from "../../lib/editorial/demo-seed";

describe("fictional editorial seed data", () => {
  it("labels every story and entity as fictional demo material", () => {
    expect(DEMO_STORIES.every((story) => story.isDemo)).toBe(true);
    expect(
      DEMO_STORIES.every(
        (story) =>
          story.title.includes("[DEMO") &&
          story.disclaimer === DEMO_CONTENT_DISCLAIMER,
      ),
    ).toBe(true);
    expect(DEMO_ENTITIES.every((entity) => entity.isFictional)).toBe(true);
  });

  it("uses reserved example domains and fixed historical demo timestamps", () => {
    expect(DEMO_SOURCES.every((source) => source.domain.endsWith(".example"))).toBe(
      true,
    );
    expect(
      DEMO_TRENDS.every(
        (trend) =>
          trend.firstDetectedAt.startsWith("2000-") &&
          trend.latestDetectedAt.startsWith("2000-"),
      ),
    ).toBe(true);
  });

  it("demonstrates developing, correction, and human-review states", () => {
    const states = new Set(DEMO_STORIES.map((story) => story.editorialState));
    expect(states.has("DEVELOPING")).toBe(true);
    expect(states.has("CORRECTED")).toBe(true);
    expect(states.has("HUMAN_REVIEW_REQUIRED")).toBe(true);
    expect(
      DEMO_STORIES.find((story) => story.editorialState === "CORRECTED"),
    ).toHaveProperty("correctionNote");
  });
});
