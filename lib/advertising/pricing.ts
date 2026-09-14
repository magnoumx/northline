import type { PricingModel } from "./types";

export interface BillingEvidence {
  contractedDays?: number;
  validatedImpressions?: number;
  validatedViewableImpressions?: number;
  validatedClicks?: number;
  attributableRevenueCents?: number;
  sponsorshipShareBasisPoints?: number;
}

export interface PriceResult {
  amountCents: number;
  billableUnits: number;
  evidenceClass: "CONTRACT" | "VALIDATED_EVENTS" | "VALIDATED_REVENUE";
}

function nonNegativeInteger(value: number | undefined, label: string): number {
  if (value === undefined || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

export function calculatePrice(
  model: PricingModel,
  unitPriceCents: number,
  evidence: BillingEvidence,
): PriceResult {
  const unitPrice = nonNegativeInteger(unitPriceCents, "unit price");

  switch (model) {
    case "FLAT_FEE":
    case "NEWSLETTER_FLAT_FEE":
    case "SPONSORED_CONTENT_FEE":
      return {
        amountCents: unitPrice,
        billableUnits: 1,
        evidenceClass: "CONTRACT",
      };
    case "CPD": {
      const days = nonNegativeInteger(evidence.contractedDays, "contracted days");
      return {
        amountCents: checkedMultiply(unitPrice, days),
        billableUnits: days,
        evidenceClass: "CONTRACT",
      };
    }
    case "CPM": {
      const impressions = nonNegativeInteger(
        evidence.validatedImpressions,
        "validated impressions",
      );
      return {
        amountCents: checkedRoundedRate(impressions, unitPrice, 1_000),
        billableUnits: impressions,
        evidenceClass: "VALIDATED_EVENTS",
      };
    }
    case "VIEWABLE_CPM": {
      const viewable = nonNegativeInteger(
        evidence.validatedViewableImpressions,
        "validated viewable impressions",
      );
      return {
        amountCents: checkedRoundedRate(viewable, unitPrice, 1_000),
        billableUnits: viewable,
        evidenceClass: "VALIDATED_EVENTS",
      };
    }
    case "CPC": {
      const clicks = nonNegativeInteger(
        evidence.validatedClicks,
        "validated clicks",
      );
      return {
        amountCents: checkedMultiply(clicks, unitPrice),
        billableUnits: clicks,
        evidenceClass: "VALIDATED_EVENTS",
      };
    }
    case "SPONSORSHIP_SHARE": {
      const revenue = nonNegativeInteger(
        evidence.attributableRevenueCents,
        "attributable revenue",
      );
      const basisPoints = nonNegativeInteger(
        evidence.sponsorshipShareBasisPoints,
        "share basis points",
      );
      if (basisPoints > 10_000) throw new Error("share basis points cannot exceed 10000");
      return {
        amountCents: checkedRoundedRate(revenue, basisPoints, 10_000),
        billableUnits: revenue,
        evidenceClass: "VALIDATED_REVENUE",
      };
    }
  }
}

export function calculateInvoiceTotals(input: {
  lineAmountsCents: readonly number[];
  taxBasisPoints: number;
  creditCents?: number;
}): {
  subtotalCents: number;
  taxCents: number;
  creditCents: number;
  totalCents: number;
} {
  const subtotalCents = input.lineAmountsCents.reduce(
    (sum, amount) => checkedAdd(sum, nonNegativeInteger(amount, "line amount")),
    0,
  );
  const taxBasisPoints = nonNegativeInteger(input.taxBasisPoints, "tax basis points");
  if (taxBasisPoints > 100_000) throw new Error("tax basis points are outside policy");
  const creditCents = Math.min(
    nonNegativeInteger(input.creditCents ?? 0, "credit"),
    subtotalCents,
  );
  const taxableCents = subtotalCents - creditCents;
  const taxCents = checkedRoundedRate(taxableCents, taxBasisPoints, 10_000);
  return {
    subtotalCents,
    taxCents,
    creditCents,
    totalCents: checkedAdd(taxableCents, taxCents),
  };
}

function checkedRoundedRate(units: number, rate: number, divisor: number): number {
  const product = checkedMultiply(units, rate);
  const result = Math.round(product / divisor);
  if (!Number.isSafeInteger(result)) throw new Error("calculated amount is unsafe");
  return result;
}

function checkedMultiply(left: number, right: number): number {
  const result = left * right;
  if (!Number.isSafeInteger(result)) throw new Error("calculated amount is unsafe");
  return result;
}

function checkedAdd(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error("calculated amount is unsafe");
  return result;
}
