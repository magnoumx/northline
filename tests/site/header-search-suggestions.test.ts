import { describe, expect, it } from "vitest";
import { distinctSubjects } from "../../lib/site/search-suggestions";

describe("search suggestions", () => {
  it("excludes category names, since the nav bar already covers them", () => {
    const result = distinctSubjects(["Sports", "U.S. News", "Andrey Rublev", "Weather"]);
    expect(result).toEqual(["Andrey Rublev"]);
  });

  it("is case-insensitive when matching category names", () => {
    expect(distinctSubjects(["sports", "ENTERTAINMENT"])).toEqual([]);
  });

  it("de-duplicates case-insensitively while keeping the first casing seen", () => {
    const result = distinctSubjects(["Chicago Cubs", "chicago cubs", "CHICAGO CUBS"]);
    expect(result).toEqual(["Chicago Cubs"]);
  });

  it("drops empty or whitespace-only entries", () => {
    expect(distinctSubjects(["", "   ", "Lewis Hamilton"])).toEqual(["Lewis Hamilton"]);
  });

  it("returns an empty list when every topic is a category name", () => {
    expect(distinctSubjects(["Sports", "Entertainment", "Weather"])).toEqual([]);
  });
});
