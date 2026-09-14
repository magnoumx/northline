import { describe, expect, it } from "vitest";
import {
  calculateReadingProgressBps,
  canResumeReading,
  changedSinceLastVisit,
  searchArticleItems,
} from "../../lib/reader/retention";

describe("reader retention", () => {
  it("calculates and clamps article progress", () => {
    expect(
      calculateReadingProgressBps({
        scrollY: 600,
        articleTop: 100,
        articleHeight: 1_500,
        viewportHeight: 500,
      }),
    ).toBe(5_000);
    expect(
      calculateReadingProgressBps({
        scrollY: -50,
        articleTop: 100,
        articleHeight: 1_500,
        viewportHeight: 500,
      }),
    ).toBe(0);
    expect(
      calculateReadingProgressBps({
        scrollY: 9_000,
        articleTop: 100,
        articleHeight: 1_500,
        viewportHeight: 500,
      }),
    ).toBe(10_000);
  });

  it("offers resume only for a meaningful incomplete read", () => {
    expect(canResumeReading(499)).toBe(false);
    expect(canResumeReading(500)).toBe(true);
    expect(canResumeReading(9_499)).toBe(true);
    expect(canResumeReading(9_500)).toBe(false);
  });

  it("detects a changed published version without flagging a first visit", () => {
    expect(changedSinceLastVisit(null, "v2")).toBe(false);
    expect(changedSinceLastVisit("v2", "v2")).toBe(false);
    expect(changedSinceLastVisit("v1", "v2")).toBe(true);
  });

  it("searches article sections case-insensitively and respects limits", () => {
    const items = [
      { label: "Opening", text: "Shared batteries lower peak demand." },
      { label: "Context", text: "Battery reliability remains under review." },
      { label: "Next", text: "Auditors publish results in August." },
    ];
    expect(searchArticleItems(items, "BATTERY", 1)).toEqual([items[1]]);
    expect(searchArticleItems(items, "a")).toEqual([]);
  });
});
