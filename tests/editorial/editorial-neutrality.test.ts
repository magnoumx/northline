import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assessNeutrality, isPoliticalStory } from "../../lib/editorial/editorial-neutrality";

const flat = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8").replace(/\s+/gu, " ");

const filler = (words: number, sentence: string) =>
  Array.from({ length: Math.ceil(words / sentence.split(" ").length) }, () => sentence).join(" ");

// The published Schumer story, 2026-10-14: an opinionated dek, no attribution
// in 1,461 words, filed as US_NEWS so the high-risk rule never applied.
describe("neutrality checks", () => {
  it("flags loaded words in the headline or dek", () => {
    const result = assessNeutrality({
      headline: "Schumer Declares Senate Leadership Bid After Blocking Trump Ads",
      subheadline:
        "A crucial judicial victory against administration propaganda provides political lift.",
      body: "",
    });
    expect(result.loadedTerms).toEqual(["propaganda", "crucial"]);
  });

  it("does not flag a neutral headline or a quoted word in the body", () => {
    const result = assessNeutrality({
      headline: "Court Blocks Federal Ad Campaign Ahead of Senate Vote",
      subheadline: "The ruling halts the spots while the lawsuit continues.",
      body: 'Schumer called the ads "propaganda," his office said in a statement.',
    });
    expect(result.loadedTerms).toEqual([]);
    expect(result.missingAttribution).toBe(false);
  });

  it("matches whole words only", () => {
    expect(
      assessNeutrality({ headline: "Epicenter of the quake shifts", body: "" }).loadedTerms,
    ).toEqual([]);
  });

  it("flags a long body that never attributes anything", () => {
    const body = filler(500, "The measure changes how the program works for families this year.");
    expect(assessNeutrality({ headline: "x", body }).missingAttribution).toBe(true);
    expect(
      assessNeutrality({ headline: "x", body: `${body} Officials said the rule starts in May.` })
        .missingAttribution,
    ).toBe(false);
  });

  it("does not judge attribution on a short body", () => {
    expect(assessNeutrality({ headline: "x", body: "Short update." }).missingAttribution).toBe(false);
  });

  it("recognises a political story from three distinct terms", () => {
    const political = assessNeutrality({
      headline: "Schumer Declares Senate Leadership Bid",
      body: "Republicans in Congress said the caucus would meet Tuesday.",
    });
    expect(isPoliticalStory(political)).toBe(true);
  });

  it("does not call a sports or business story political", () => {
    const sports = assessNeutrality({
      headline: "Packers president praises campaign after playoff vote",
      body: "The club president said the campaign was the best in a decade.",
    });
    expect(isPoliticalStory(sports)).toBe(false);
  });

  it("routes each finding to review in the newsroom gate", () => {
    const newsroom = flat("../../lib/editorial/autonomous-newsroom.ts");
    expect(newsroom).toContain('reasons.push("loaded_language_in_display_copy")');
    expect(newsroom).toContain('reasons.push("missing_attribution")');
    expect(newsroom).toContain('if (!categoryBlocked && isPoliticalStory(neutrality)) reasons.push("political_content");');
    expect(flat("../../lib/ai/editorial-gateway.ts")).toContain(
      "The headline and the dek (subheadline) report news, not opinion",
    );
  });
});
