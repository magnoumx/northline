import { describe, expect, it } from "vitest";
import {
  deriveTopics,
  keywordsFor,
  subjectsFromQueries,
  topicSlug,
} from "../../lib/editorial/topic-derivation";

// The exact queries the pipeline produced for a real published article.
const breslinQueries = [
  "Little Miss Sunshine 20th anniversary cast reunion",
  "Abigail Breslin new movies 2026",
  "Abigail Breslin career update",
  "Little Miss Sunshine streaming Hulu Disney+",
  "Abigail Breslin I Killed Him in My Sleep",
  "Abigail Breslin Sundance 2026 red carpet",
  "Little Miss Sunshine Oscar nomination Abigail Breslin",
  "Abigail Breslin producer Slayers",
];

describe("subjects from search queries", () => {
  it("finds the recurring subject rather than the query scaffolding", () => {
    const subjects = subjectsFromQueries(breslinQueries);
    expect(subjects).toContain("Abigail Breslin");
    expect(subjects).toContain("Little Miss Sunshine");
  });

  it("discards query words that carry no subject", () => {
    const subjects = subjectsFromQueries(breslinQueries).map((subject) =>
      subject.toLowerCase(),
    );
    for (const noise of ["new movies", "career update", "red carpet"]) {
      expect(subjects).not.toContain(noise);
    }
  });

  it("ignores a phrase that appears only once", () => {
    // One combination of words is a query, not a subject.
    expect(
      subjectsFromQueries(["Some Rare Thing happened once"]),
    ).toHaveLength(0);
  });

  it("does not treat a bare year as a subject", () => {
    const subjects = subjectsFromQueries([
      "Sundance 2026 lineup",
      "Sundance 2026 winners",
    ]);
    expect(subjects.join(" ")).not.toMatch(/^\d{4}$/u);
    expect(subjects).toContain("Sundance 2026");
  });
});

describe("derived topics", () => {
  it("always files the story under its category", () => {
    const topics = deriveTopics({ category: "ENTERTAINMENT" });
    expect(topics[0]).toEqual({
      slug: "entertainment",
      name: "Entertainment",
      kind: "CATEGORY",
    });
  });

  it("adds the story's subjects alongside the category", () => {
    const topics = deriveTopics({
      category: "ENTERTAINMENT",
      secondaryQueries: breslinQueries,
    });
    const slugs = topics.map((topic) => topic.slug);
    expect(slugs).toContain("abigail-breslin");
    expect(slugs).toContain("little-miss-sunshine");
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("renders a readable name for an unmapped category", () => {
    expect(deriveTopics({ category: "INTERNET_TRENDS" })[0].name).toBe(
      "Internet",
    );
    expect(deriveTopics({ category: "ODD_ONE" })[0].name).toBe("Odd One");
  });
});

describe("keywords", () => {
  it("was empty because topics were never stored", () => {
    // The published pages carried keywords:"" for exactly this reason.
    expect(keywordsFor({ topics: [] })).toBe("");
  });

  it("prefers what readers actually search for", () => {
    const keywords = keywordsFor({
      topics: ["Entertainment", "Abigail Breslin"],
      secondaryQueries: breslinQueries,
    });
    expect(keywords).toContain("Abigail Breslin");
    expect(keywords).toContain("Little Miss Sunshine 20th anniversary");
  });

  it("stays a summary rather than a keyword dump", () => {
    const keywords = keywordsFor({
      topics: Array.from({ length: 40 }, (_, index) => `Topic ${index}`),
    });
    expect(keywords.split(", ")).toHaveLength(12);
  });

  it("does not repeat the same phrase in different cases", () => {
    const keywords = keywordsFor({
      topics: ["Sundance", "sundance", "SUNDANCE"],
    });
    expect(keywords).toBe("Sundance");
  });
});

describe("slugs", () => {
  it("produces a URL-safe slug", () => {
    expect(topicSlug("Little Miss Sunshine")).toBe("little-miss-sunshine");
    expect(topicSlug("  U.S. News  ")).toBe("u-s-news");
  });
});

describe("overlapping subjects", () => {
  it("keeps one form of a subject, not three", () => {
    // Sliding windows produced "Colton Smith", "Colton Smith ATP" and
    // "Smith ATP" for one player, which would have split his topic page and
    // his internal links across three near-duplicate slugs.
    const subjects = subjectsFromQueries([
      "Colton Smith ATP ranking",
      "Colton Smith ATP titles",
      "Colton Smith tennis",
    ]);
    const lowered = subjects.map((subject) => subject.toLowerCase());
    expect(lowered).toContain("colton smith atp");
    expect(lowered).not.toContain("colton smith");
    expect(lowered).not.toContain("smith atp");
  });
});

describe("queries as readers actually type them", () => {
  it("finds a subject in lowercase queries", () => {
    // Requiring capitalisation rejected these outright, so 18 of 22 published
    // articles ended up filed under nothing but their category.
    const subjects = subjectsFromQueries([
      "2027 social security cola",
      "social security raise 2027",
      "social security cola increase medicare",
    ]);
    expect(subjects.join(" | ").toLowerCase()).toContain("social security");
  });

  it("renders a lowercase name properly", () => {
    const subjects = subjectsFromQueries([
      "ryan garcia wbc title",
      "ryan garcia next fight",
    ]);
    expect(subjects).toContain("Ryan Garcia");
  });

  it("prefers a properly cased sighting over a typed one", () => {
    const subjects = subjectsFromQueries([
      "ryan garcia next fight",
      "Ryan Garcia WBC welterweight",
    ]);
    expect(subjects).toContain("Ryan Garcia");
    expect(subjects).not.toContain("ryan garcia");
  });

  it("still refuses a phrase seen only once", () => {
    expect(subjectsFromQueries(["some rare thing happened"])).toHaveLength(0);
  });

  it("still keeps query scaffolding out", () => {
    const subjects = subjectsFromQueries([
      "ryan garcia fight live stream",
      "ryan garcia fight full video",
    ]).map((s) => s.toLowerCase());
    for (const noise of ["live stream", "full video", "fight live"]) {
      expect(subjects).not.toContain(noise);
    }
  });
});
