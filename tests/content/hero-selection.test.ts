import { describe, expect, it } from "vitest";
import { pickHero } from "../../lib/content/d1-public-repository";

const houseGraphic = {
  role: "HERO",
  license: "Northline-owned editorial graphic",
  url: "/story-image/samsung-galaxy-s27-ultra",
};
const aiIllustration = {
  role: "HERO",
  license: "AI_GENERATED",
  url: "https://media.example/ai-abstract.png",
};
const photograph = {
  role: "HERO",
  license: "CC BY-SA 4.0",
  url: "https://media.example/commons-photo.jpg",
};

describe("hero selection on articles carrying more than one HERO", () => {
  it("does not depend on the order the database returns rows in", () => {
    // The defect: `.find()` over an unordered result. Ten published articles
    // hold both a house graphic and a leftover AI illustration, and either
    // could render on any given request.
    expect(pickHero([houseGraphic, aiIllustration])).toBe(houseGraphic);
    expect(pickHero([aiIllustration, houseGraphic])).toBe(houseGraphic);
  });

  it("prefers a licensed photograph over anything generated", () => {
    expect(pickHero([aiIllustration, houseGraphic, photograph])).toBe(photograph);
    expect(pickHero([photograph, houseGraphic, aiIllustration])).toBe(photograph);
  });

  it("still returns the AI illustration when it is the only hero", () => {
    // Ranking last is not the same as being excluded; policy allows it as the
    // last resort, and no hero at all is worse than the disclosed fallback.
    expect(pickHero([aiIllustration])).toBe(aiIllustration);
  });

  it("ignores inline media and returns nothing when no hero exists", () => {
    const inline = { role: "INLINE", license: "CC BY 4.0", url: "https://x/y.jpg" };
    expect(pickHero([inline])).toBeUndefined();
    expect(pickHero([])).toBeUndefined();
  });
});
