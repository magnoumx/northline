export interface Forecast {
  estimatedLow: number;
  estimatedHigh: number;
  alreadyReserved: number;
  availableLow: number;
  availableHigh: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  underdeliveryRisk: "LOW" | "MEDIUM" | "HIGH";
  assumptions: string[];
}

export function forecastInventory(input: {
  historicalDailyImpressions: readonly number[];
  days: number;
  alreadyReserved: number;
  requested: number;
}): Forecast {
  const clean = input.historicalDailyImpressions.filter(
    (value) => Number.isSafeInteger(value) && value >= 0,
  );
  if (
    clean.length === 0 ||
    !Number.isSafeInteger(input.days) ||
    input.days <= 0
  ) {
    return {
      estimatedLow: 0,
      estimatedHigh: 0,
      alreadyReserved: Math.max(0, input.alreadyReserved),
      availableLow: 0,
      availableHigh: 0,
      confidence: "LOW",
      underdeliveryRisk: input.requested > 0 ? "HIGH" : "LOW",
      assumptions: ["No usable historical inventory was available."],
    };
  }
  const sorted = [...clean].sort((left, right) => left - right);
  const lowDaily = percentile(sorted, 0.2);
  const highDaily = percentile(sorted, 0.8);
  const estimatedLow = Math.floor(lowDaily * input.days * 0.9);
  const estimatedHigh = Math.floor(highDaily * input.days * 1.05);
  const alreadyReserved = Math.max(0, input.alreadyReserved);
  const availableLow = Math.max(0, estimatedLow - alreadyReserved);
  const availableHigh = Math.max(0, estimatedHigh - alreadyReserved);
  const confidence =
    clean.length >= 28 ? "HIGH" : clean.length >= 14 ? "MEDIUM" : "LOW";
  const underdeliveryRisk =
    input.requested > availableHigh
      ? "HIGH"
      : input.requested > availableLow
        ? "MEDIUM"
        : "LOW";
  return {
    estimatedLow,
    estimatedHigh,
    alreadyReserved,
    availableLow,
    availableHigh,
    confidence,
    underdeliveryRisk,
    assumptions: [
      "Range uses the 20th–80th percentile of historical daily eligible inventory.",
      "The low case includes a 10% safety discount.",
      "Reserved inventory is removed before availability is shown.",
      "This is an estimate, not a delivery guarantee.",
    ],
  };
}

function percentile(sorted: readonly number[], value: number): number {
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * value)),
  );
  return sorted[index] ?? 0;
}

