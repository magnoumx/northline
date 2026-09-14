import { describe, expect, it } from "vitest";
import {
  detectEventRecency,
  DEFAULT_MAXIMUM_EVENT_AGE_MONTHS,
} from "../../lib/editorial/event-recency";

const PUBLISHED = new Date("2026-08-16T15:04:00Z");

describe("event recency", () => {
  it("flags the Bears contract story that shipped as 2026 news", () => {
    // Verbatim opening of the article published 16 Aug 2026 describing a
    // contract signed in July 2024, submitted to Google News as current.
    const body =
      "In July 2024, the Chicago Bears took a definitive step toward long-term " +
      "offensive stability by signing wide receiver DJ Moore to a lucrative " +
      "four-year extension worth $110 million.";
    const result = detectEventRecency(body, PUBLISHED);
    expect(result.stale).toBe(true);
    expect(result.anchorYear).toBe(2024);
    expect(result.anchorMonth).toBe(7);
    expect(result.monthsBehind).toBe(25);
  });

  it("flags a spring-training piece published months after the season", () => {
    const body =
      "Rangers pitchers and catchers reported to Surprise, Arizona during the " +
      "2025 spring training period with questions surrounding the rotation.";
    expect(detectEventRecency(body, PUBLISHED).stale).toBe(true);
  });

  it("accepts reporting anchored in the present", () => {
    const body =
      "In August 2026, the Arizona Cardinals announced that Larry Fitzgerald's " +
      "No. 11 will be retired at halftime of the October 25 game.";
    const result = detectEventRecency(body, PUBLISHED);
    expect(result.stale).toBe(false);
    expect(result.anchorYear).toBe(2026);
  });

  it("does not punish a current story for citing history later on", () => {
    // The anchor is the lede. A drought reference deep in the piece is normal
    // reporting and must not block publication.
    const body =
      "The Cardinals confirmed on Monday that the ceremony will take place at " +
      "State Farm Stadium. ".padEnd(720, " ") +
      "The franchise has not retired a number since 2019.";
    expect(detectEventRecency(body, PUBLISHED).stale).toBe(false);
  });

  it("ignores a bare year with no temporal phrase around it", () => {
    // "$2024" or a jersey number must not read as a date anchor.
    const body =
      "The deal is worth 2024 dollars per appearance under the revised terms " +
      "agreed by both parties.";
    expect(detectEventRecency(body, PUBLISHED).stale).toBe(false);
  });

  it("returns no verdict when the lede carries no temporal anchor", () => {
    const body =
      "The Arizona Cardinals will retire a number and induct a receiver into " +
      "the Ring of Honor at halftime.";
    const result = detectEventRecency(body, PUBLISHED);
    expect(result.stale).toBe(false);
    expect(result.anchorYear).toBeUndefined();
  });

  it("measures a year-only anchor from the end of that year", () => {
    // "in 2026" must not be read as January 2026 and counted as eight months old.
    const body = "In 2026 the league restructured its scheduling formula.";
    const result = detectEventRecency(body, PUBLISHED);
    expect(result.stale).toBe(false);
    expect(result.monthsBehind).toBeLessThanOrEqual(DEFAULT_MAXIMUM_EVENT_AGE_MONTHS);
  });

  it("keeps the most recent anchor when the lede names several", () => {
    const body =
      "In 2019 the team rebuilt its roster, and in June 2026 it completed the " +
      "final phase of that plan.";
    const result = detectEventRecency(body, PUBLISHED);
    expect(result.anchorYear).toBe(2026);
    expect(result.stale).toBe(false);
  });

  it("honours a caller-supplied window", () => {
    const body = "In March 2026 the commission published its findings.";
    expect(detectEventRecency(body, PUBLISHED, { maximumAgeMonths: 1 }).stale).toBe(true);
    expect(detectEventRecency(body, PUBLISHED, { maximumAgeMonths: 12 }).stale).toBe(false);
  });

  it("flags a full calendar date just past the lede cutoff (O.J. Simpson)", () => {
    // The retrospective that slipped through: a 2024 death restamped as 2026
    // news, with the giveaway date sitting just beyond the old 700-char lede.
    const body =
      "The estate battle continues to draw attention across legal circles. ".padEnd(760, " ") +
      "O.J. Simpson died on April 10, 2024, at the age of 76, leaving the " +
      "Goldman family's civil judgment largely unpaid.";
    const result = detectEventRecency(body, PUBLISHED);
    expect(result.stale).toBe(true);
    expect(result.anchorYear).toBe(2024);
    expect(result.anchorMonth).toBe(4);
  });

  it("flags a bout dated with a full date (Tyson vs Paul)", () => {
    const body =
      "The heavyweight spectacle streamed to a record audience. ".padEnd(740, " ") +
      "On November 15, 2024, former undisputed champion Mike Tyson faced Jake " +
      "Paul in a sanctioned professional bout.";
    expect(detectEventRecency(body, PUBLISHED).stale).toBe(true);
  });

  it("flags a hedged month anchor (late January 2025)", () => {
    const body =
      "In late January 2025, a ring sighting triggered viral speculation about " +
      "a secret wedding.";
    expect(detectEventRecency(body, PUBLISHED).stale).toBe(true);
  });

  it("does not flag a current story that carries a present full date", () => {
    const body =
      "On August 12, 2026, the league confirmed the schedule for the coming " +
      "season, with the opener set for next month.";
    expect(detectEventRecency(body, PUBLISHED).stale).toBe(false);
  });

  it("still ignores an old full date buried deep past the wider window", () => {
    // Beyond 1200 chars a full date is history, not the event being reported.
    const body =
      "The museum's new wing opens to the public this week. ".padEnd(1240, " ") +
      "The building first opened on June 3, 2011.";
    expect(detectEventRecency(body, PUBLISHED).stale).toBe(false);
  });

});
