import { describe, expect, it } from "vitest";
import {
  collectLinkableEntities,
  linkifyParagraph,
  properNounPhrases,
} from "../../lib/content/entity-links";

const published = [
  {
    slug: "van-der-poel-wins-in-paris",
    headline: "Van der Poel Wins in Paris as Pogacar Claims Fifth Tour de France Crown",
    dek: "The Dutch rider beat Jasper Philipsen on the Champs-Elysees.",
    topics: ["Tour de France"],
  },
  {
    slug: "colton-smith-tennis",
    headline: "Colton Smith Is America's Most Unlikely Tennis Star",
    dek: "The 23-year-old from rural Washington has climbed the rankings.",
    topics: ["Tennis"],
  },
];

describe("linkable entities", () => {
  it("only offers subjects we have actually published", () => {
    const entities = collectLinkableEntities(published);
    const targets = new Set(entities.map((entity) => entity.href));
    expect(targets).toEqual(
      new Set(["/story/van-der-poel-wins-in-paris", "/story/colton-smith-tennis"]),
    );
  });

  it("never links a story to itself", () => {
    const entities = collectLinkableEntities(published, {
      excludeSlug: "colton-smith-tennis",
    });
    expect(
      entities.some((entity) => entity.href.includes("colton-smith")),
    ).toBe(false);
  });

  it("prefers the longest phrase so a place does not shadow an event", () => {
    const entities = collectLinkableEntities(published);
    const phrases = entities.map((entity) => entity.phrase);
    const tour = phrases.indexOf("Tour de France");
    expect(tour).toBeGreaterThan(-1);
    // Longest phrases sort first, so a broader term can never shadow it.
    expect(phrases[0].length).toBeGreaterThanOrEqual("Tour de France".length);
  });

  it("ignores ordinary words and dates that happen to be capitalised", () => {
    const entities = collectLinkableEntities([
      { slug: "s", headline: "x", dek: "Filed on Monday by the desk.", topics: [] },
    ]);
    expect(entities.map((entity) => entity.phrase)).not.toContain("Monday");
  });
});

describe("paragraph linking", () => {
  it("links the first mention and leaves the rest as prose", () => {
    const entities = collectLinkableEntities(published);
    const used = new Set<string>();

    const first = linkifyParagraph(
      "Tour de France organisers confirmed the route.",
      entities,
      used,
    );
    const second = linkifyParagraph(
      "The Tour de France returns next July.",
      entities,
      used,
    );

    expect(first.some((segment) => segment.kind === "link")).toBe(true);
    // Repeating the same link in every paragraph reads as spam.
    expect(second.every((segment) => segment.kind === "text")).toBe(true);
  });

  it("preserves the paragraph text exactly", () => {
    const paragraph = "Tour de France organisers confirmed the route.";
    const segments = linkifyParagraph(
      paragraph,
      collectLinkableEntities(published),
      new Set(),
    );
    expect(segments.map((segment) => segment.value).join("")).toBe(paragraph);
  });

  it("stops once the article has enough links", () => {
    const entities = collectLinkableEntities(published);
    const used = new Set(["already", "at", "the", "cap", "x", "y", "z", "w"]);
    const segments = linkifyParagraph(
      "Tour de France organisers confirmed the route.",
      entities,
      used,
      { maximumLinks: 8 },
    );
    expect(segments.every((segment) => segment.kind === "text")).toBe(true);
  });

  it("does not match a phrase inside a longer word", () => {
    const segments = linkifyParagraph(
      "Parisian cafes stayed open.",
      [{ phrase: "Paris", href: "/story/x" }],
      new Set(),
    );
    expect(segments.every((segment) => segment.kind === "text")).toBe(true);
  });
});

describe("proper noun extraction", () => {
  it("keeps multi-word names together in sentence-cased prose", () => {
    expect(
      properNounPhrases("The stage was won by Van der Poel in Paris."),
    ).toContain("Van der Poel");
  });

  it("is not trusted on a title-cased headline", () => {
    // Every word is capitalised there, so the extractor cannot tell a name
    // from a verb. This is why entities come from the deck and the topics.
    expect(properNounPhrases("Van der Poel Wins in Paris")).toContain(
      "Van der Poel Wins",
    );
  });
});

describe("headline noise", () => {
  it("recovers the name from a title-cased headline", () => {
    // Without this the extractor produced "Van der Poel Wins", a phrase that
    // never appears in the prose, so no article ever gained a single link.
    const entities = collectLinkableEntities([
      {
        slug: "vdp",
        headline: "Van der Poel Wins in Paris as Pogacar Claims Fifth Crown",
        topics: [],
      },
    ]);
    expect(entities.map((entity) => entity.phrase)).toContain("Van der Poel");
  });

  it("links that recovered name inside prose", () => {
    const entities = collectLinkableEntities([
      { slug: "vdp", headline: "Van der Poel Wins in Paris", topics: [] },
    ]);
    const segments = linkifyParagraph(
      "The stage went to Van der Poel on the final climb.",
      entities,
      new Set(),
    );
    const link = segments.find((segment) => segment.kind === "link");
    expect(link?.value).toBe("Van der Poel");
    expect(segments.map((segment) => segment.value).join("")).toBe(
      "The stage went to Van der Poel on the final climb.",
    );
  });
});
