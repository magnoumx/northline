import { describe, expect, it } from "vitest";
import {
  isFirstPartyForSubject,
  resolveDiscoveryLeads,
} from "../../lib/editorial/source-authority";

// 2026-10-29 13:30: "dead by daylight" (an official trailer) stopped at live
// search with 0 primary leads. The brand of deadbydaylight.com is one token and
// the trend is three words, so the first-party match could never fire.
describe("first-party brand match", () => {
  it("matches a brand written as several words in the subject", () => {
    expect(isFirstPartyForSubject("deadbydaylight.com", "dead by daylight")).toBe(true);
    expect(isFirstPartyForSubject("www.callofduty.com", "Call of Duty season 6 trailer")).toBe(true);
    expect(isFirstPartyForSubject("about.netflix.com", "Netflix Orders The Gentlemen Season 2")).toBe(true);
  });

  it("only matches whole words", () => {
    expect(isFirstPartyForSubject("netflix.com", "netflixandchill trend")).toBe(false);
    expect(isFirstPartyForSubject("deadbyday.com", "dead by daylight")).toBe(false);
    expect(isFirstPartyForSubject("adbyday.com", "dead by daylight")).toBe(false);
  });

  it("does not promote generic compound domains", () => {
    expect(isFirstPartyForSubject("goldprice.org", "gold price today")).toBe(false);
    expect(isFirstPartyForSubject("newyork.com", "New York weather")).toBe(false);
    expect(isFirstPartyForSubject("bydaylight.com", "dead by daylight")).toBe(false);
    expect(isFirstPartyForSubject("weatherchannel.com", "weather channel radar")).toBe(false);
  });

  it("keeps the existing guards", () => {
    expect(isFirstPartyForSubject("nvidia.com", "jensen huang")).toBe(false);
    expect(isFirstPartyForSubject("bloomberg.com", "Bloomberg reports gold slips")).toBe(false);
    expect(isFirstPartyForSubject("ign.com", "ign news")).toBe(false);
    expect(isFirstPartyForSubject("deadbydaylight.com", undefined)).toBe(false);
  });

  it("makes the official site a primary lead at live search", () => {
    const leads = resolveDiscoveryLeads(
      [
        { url: "https://deadbydaylight.com/news/terrifier", sourceKind: "INDEPENDENT" as const },
        { url: "https://www.ign.com/videos/dead-by-daylight", sourceKind: "PRIMARY" as const },
      ],
      [],
      "dead by daylight",
    );
    expect(leads.map((lead) => lead.sourceKind)).toEqual(["PRIMARY", "INDEPENDENT"]);
  });
});
