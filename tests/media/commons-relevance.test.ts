import { describe, expect, it } from "vitest";
import { isRelevantCandidate } from "../../lib/media/commons-editorial";

const headline =
  "Van der Poel Wins in Paris as Pogacar Claims Fifth Tour de France Crown";
const subject = "Mathieu van der Poel Tadej Pogacar Tour de France";

describe("commons candidate relevance", () => {
  it("rejects a portrait of someone the story is not about", () => {
    // Observed in production: this exact portrait was attached to two unrelated
    // articles because two ordinary words overlapped with each headline.
    expect(
      isRelevantCandidate(
        {
          pageTitle: "File:Rebecca Ferguson Milan Italy.jpg",
          description: "Rebecca Ferguson attending an event in Milan, Italy",
        },
        headline,
        subject,
      ),
    ).toBe(false);
  });

  it("rejects a building that shares only incidental vocabulary", () => {
    expect(
      isRelevantCandidate(
        {
          pageTitle: "File:Crossroads Baptist Church, Rossmore 003.jpg",
          description: "A church building photographed in Rossmore",
        },
        headline,
        subject,
      ),
    ).toBe(false);
  });

  it("accepts a photograph that names the story's subject", () => {
    expect(
      isRelevantCandidate(
        {
          pageTitle: "File:Mathieu van der Poel 2026.jpg",
          description: "Mathieu van der Poel racing during the Tour de France",
        },
        headline,
        subject,
      ),
    ).toBe(true);
  });

  it("rejects a different person who happens to share one name", () => {
    // The defect: a single matching term was enough, so a search for the
    // tennis player Andrey Rublev could accept a portrait of Andrei Rublev,
    // the 15th-century icon painter - Commons catalogues him under the same
    // surname, and "rublev" alone used to satisfy relevance.
    expect(
      isRelevantCandidate(
        {
          pageTitle: "File:Andrei Rublev Trinity icon.jpg",
          description: "Icon of the Holy Trinity attributed to Andrei Rublev",
        },
        "Andrey Rublev Reclaims ATP Title in Straight Sets",
        "Andrey Rublev",
      ),
    ).toBe(false);
  });

  it("still accepts a two-word subject when a photo names both words", () => {
    expect(
      isRelevantCandidate(
        {
          pageTitle: "File:Andrey Rublev US Open 2026.jpg",
          description: "Andrey Rublev serving during a match at the US Open",
        },
        "Andrey Rublev Reclaims ATP Title in Straight Sets",
        "Andrey Rublev",
      ),
    ).toBe(true);
  });

  it("accepts one name out of a multi-person subject rather than demanding all of them", () => {
    // A subject naming two riders must not reject a photo of just one of them.
    expect(
      isRelevantCandidate(
        {
          pageTitle: "File:Tadej Pogacar 2026.jpg",
          description: "Tadej Pogacar riding during a mountain stage",
        },
        headline,
        subject,
      ),
    ).toBe(true);
  });

  it("rejects Roger Moore for a DJ Moore story", () => {
    // The production failure this gate exists to prevent, and did not: the
    // article was about Chicago Bears receiver DJ Moore, and Sir Roger Moore's
    // portrait was published as its hero image, og:image and schema image.
    //
    // "DJ" is two characters and does not survive the meaningful-term floor, so
    // the subject reduced to the single term "moore". The old threshold of
    // Math.min(2, subjectTerms.length) collapsed to "one match is enough" and
    // any Moore on Commons satisfied it.
    expect(
      isRelevantCandidate(
        {
          pageTitle: "File:Sir Roger Moore crop.jpg",
          description: "Sir Roger Moore, English actor, at a public event",
        },
        "DJ Moore Secures $110M Bears Extension as Franchise Core",
        "DJ Moore",
      ),
    ).toBe(false);
  });

  it("rejects a landscape that shares one incidental word with the subject", () => {
    // Also live in production: Ansel Adams' "The Tetons and the Snake River"
    // illustrated a story about Everglades pythons, matched on "snake".
    expect(
      isRelevantCandidate(
        {
          pageTitle: "File:Ansel Adams - The Tetons and the Snake River.jpg",
          description: "The Tetons and the Snake River, Grand Teton National Park, 1942",
        },
        "Florida Removes 11,000 Pythons From the Everglades",
        "Everglades python",
      ),
    ).toBe(false);
  });

  it("falls back to no photograph when a subject cannot be verified in two terms", () => {
    // A single-term subject cannot be told apart from anything sharing that
    // word, so it must fail even when the candidate genuinely contains it.
    // Losing this match is the intended cost of never shipping a wrong face.
    expect(
      isRelevantCandidate(
        {
          pageTitle: "File:Everglades National Park sunrise.jpg",
          description: "Sawgrass marsh in Everglades National Park at sunrise",
        },
        "Florida Removes 11,000 Pythons From the Everglades",
        "Everglades",
      ),
    ).toBe(false);
  });

  it("demands a stronger match when no subject anchors the search", () => {
    const weak = {
      pageTitle: "File:Paris street.jpg",
      description: "A street in Paris",
    };
    // Two incidental words used to be enough; without a subject the bar is higher.
    expect(isRelevantCandidate(weak, headline)).toBe(false);
    expect(
      isRelevantCandidate(
        {
          pageTitle: "File:Tour de France Paris finish.jpg",
          description: "The Tour de France finish in Paris, with Pogacar",
        },
        headline,
      ),
    ).toBe(true);
  });
});

describe("domain contradiction", () => {
  it("rejects a Paralympic sprinter who shares a tennis player's full name", () => {
    // Published in production: this caption satisfied a two-term match against
    // "Alexander Zverev" and ran above an ATP ranking story.
    expect(
      isRelevantCandidate(
        {
          pageTitle: "File:Alexander Zverev RUS.jpg",
          description:
            "Alexander Zverev of Russia during the Men's 400M - T13 Semifinal",
        },
        "Alexander Zverev Holds Top Three ATP Spot in Early 2025",
        "Alexander Zverev",
      ),
    ).toBe(false);
  });

  it("rejects a Philippine town's school on a Texas weather story", () => {
    expect(
      isRelevantCandidate(
        {
          pageTitle: "File:Buliran Elementary School.jpg",
          description:
            "Barangay Buliran, Buliran Elementary School, San Antonio, Nueva Ecija; Hall and St. Vincent Ferrer Chapel",
        },
        "San Antonio Weather Patterns Driven by Fronts and Moisture",
        "San Antonio",
      ),
    ).toBe(false);
  });

  it("still accepts a correct photograph of the same subject", () => {
    // The contradiction list must cost nothing on a genuine match - none of
    // those words appear in a real sports photograph's caption.
    expect(
      isRelevantCandidate(
        {
          pageTitle: "File:Alexander Zverev 2024.jpg",
          description:
            "Alexander Zverev serving during a quarter-final at the 2024 ATP Finals",
        },
        "Alexander Zverev Holds Top Three ATP Spot in Early 2025",
        "Alexander Zverev",
      ),
    ).toBe(true);
  });
});
