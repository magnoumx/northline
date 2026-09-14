import { describe, expect, it } from "vitest";
import {
  calculateInvoiceTotals,
  calculatePrice,
} from "../../lib/advertising/pricing";
import {
  evaluatePacing,
  isFrequencyCapped,
} from "../../lib/advertising/pacing";

describe("advertising pricing", () => {
  it("prices only from the evidence required by each model", () => {
    expect(
      calculatePrice("CPM", 2_500, { validatedImpressions: 12_500 }),
    ).toEqual({
      amountCents: 31_250,
      billableUnits: 12_500,
      evidenceClass: "VALIDATED_EVENTS",
    });
    expect(
      calculatePrice("VIEWABLE_CPM", 3_000, {
        validatedViewableImpressions: 8_000,
      }).amountCents,
    ).toBe(24_000);
    expect(
      calculatePrice("CPC", 175, { validatedClicks: 43 }).amountCents,
    ).toBe(7_525);
    expect(
      calculatePrice("SPONSORSHIP_SHARE", 0, {
        attributableRevenueCents: 250_000,
        sponsorshipShareBasisPoints: 2_000,
      }).amountCents,
    ).toBe(50_000);
  });

  it("rejects absent, negative, and unsafe billing values", () => {
    expect(() => calculatePrice("CPM", 1_000, {})).toThrow();
    expect(() =>
      calculatePrice("CPC", 100, { validatedClicks: -1 }),
    ).toThrow();
    expect(() =>
      calculatePrice("CPC", Number.MAX_SAFE_INTEGER, { validatedClicks: 2 }),
    ).toThrow();
  });

  it("calculates invoice totals with fixed integer arithmetic", () => {
    expect(
      calculateInvoiceTotals({
        lineAmountsCents: [10_000, 5_000],
        creditCents: 2_000,
        taxBasisPoints: 825,
      }),
    ).toEqual({
      subtotalCents: 15_000,
      creditCents: 2_000,
      taxCents: 1_073,
      totalCents: 14_073,
    });
  });
});

describe("campaign pacing and frequency", () => {
  const startsAt = new Date("2026-07-01T00:00:00Z");
  const endsAt = new Date("2026-07-11T00:00:00Z");

  it("holds an evenly paced line item that is materially ahead", () => {
    const result = evaluatePacing({
      now: new Date("2026-07-06T00:00:00Z"),
      startsAt,
      endsAt,
      goalUnits: 10_000,
      deliveredUnits: 8_500,
      pacing: "EVEN",
    });
    expect(result.state).toBe("AHEAD");
    expect(result.shouldServe).toBe(false);
  });

  it("allows an evenly paced line item that is behind", () => {
    const result = evaluatePacing({
      now: new Date("2026-07-06T00:00:00Z"),
      startsAt,
      endsAt,
      goalUnits: 10_000,
      deliveredUnits: 2_500,
      pacing: "EVEN",
    });
    expect(result.state).toBe("BEHIND");
    expect(result.shouldServe).toBe(true);
  });

  it("enforces a rolling frequency cap", () => {
    const now = new Date("2026-07-24T12:00:00Z");
    expect(
      isFrequencyCapped({
        now,
        maximumViews: 2,
        windowSeconds: 3_600,
        eventTimes: [
          new Date("2026-07-24T11:30:00Z"),
          new Date("2026-07-24T11:45:00Z"),
          new Date("2026-07-24T10:00:00Z"),
        ],
      }),
    ).toBe(true);
  });
});

