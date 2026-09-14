export interface PacingInput {
  now: Date;
  startsAt: Date;
  endsAt: Date;
  goalUnits: number;
  deliveredUnits: number;
  pacing: "EVEN" | "ASAP";
  toleranceRatio?: number;
}

export interface PacingDecision {
  shouldServe: boolean;
  state: "NOT_STARTED" | "ENDED" | "NO_GOAL" | "BEHIND" | "ON_PACE" | "AHEAD";
  elapsedRatio: number;
  deliveryRatio: number;
  targetUnitsNow: number;
}

export function evaluatePacing(input: PacingInput): PacingDecision {
  const start = input.startsAt.getTime();
  const end = input.endsAt.getTime();
  const now = input.now.getTime();
  if (end <= start) throw new Error("campaign window must have positive duration");
  if (!Number.isSafeInteger(input.goalUnits) || input.goalUnits < 0) {
    throw new Error("goal units must be a non-negative safe integer");
  }
  if (!Number.isSafeInteger(input.deliveredUnits) || input.deliveredUnits < 0) {
    throw new Error("delivered units must be a non-negative safe integer");
  }

  if (now < start) return base(false, "NOT_STARTED", 0, 0, 0);
  if (now >= end) {
    const ratio = input.goalUnits === 0 ? 1 : input.deliveredUnits / input.goalUnits;
    return base(false, "ENDED", 1, ratio, input.goalUnits);
  }
  if (input.goalUnits === 0) return base(false, "NO_GOAL", 0, 0, 0);
  if (input.pacing === "ASAP") {
    return base(
      input.deliveredUnits < input.goalUnits,
      input.deliveredUnits < input.goalUnits ? "BEHIND" : "AHEAD",
      (now - start) / (end - start),
      input.deliveredUnits / input.goalUnits,
      input.goalUnits,
    );
  }

  const elapsedRatio = clamp((now - start) / (end - start), 0, 1);
  const deliveryRatio = input.deliveredUnits / input.goalUnits;
  const tolerance = clamp(input.toleranceRatio ?? 0.05, 0, 0.25);
  const targetUnitsNow = Math.ceil(input.goalUnits * elapsedRatio);
  const state =
    deliveryRatio < Math.max(0, elapsedRatio - tolerance)
      ? "BEHIND"
      : deliveryRatio > elapsedRatio + tolerance
        ? "AHEAD"
        : "ON_PACE";
  return base(state !== "AHEAD", state, elapsedRatio, deliveryRatio, targetUnitsNow);
}

export function isFrequencyCapped(input: {
  eventTimes: readonly Date[];
  now: Date;
  maximumViews: number;
  windowSeconds: number;
}): boolean {
  if (!Number.isSafeInteger(input.maximumViews) || input.maximumViews <= 0) {
    return true;
  }
  if (!Number.isSafeInteger(input.windowSeconds) || input.windowSeconds <= 0) {
    return true;
  }
  const threshold = input.now.getTime() - input.windowSeconds * 1_000;
  return (
    input.eventTimes.filter(
      (eventTime) =>
        eventTime.getTime() > threshold && eventTime.getTime() <= input.now.getTime(),
    ).length >= input.maximumViews
  );
}

function base(
  shouldServe: boolean,
  state: PacingDecision["state"],
  elapsedRatio: number,
  deliveryRatio: number,
  targetUnitsNow: number,
): PacingDecision {
  return { shouldServe, state, elapsedRatio, deliveryRatio, targetUnitsNow };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

