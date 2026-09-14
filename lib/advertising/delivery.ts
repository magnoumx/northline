import { evaluateEligibility } from "./eligibility";
import type {
  EligibleLineItem,
  PlacementCode,
  SelectionDecision,
  TargetingContext,
} from "./types";

export interface DeliveryCandidate extends EligibleLineItem {
  creativeVersionId: string;
  creativeWeight: number;
  pacingAllowsDelivery: boolean;
  frequencyCapped: boolean;
}

export interface CandidateEvaluation {
  candidate: DeliveryCandidate;
  decision: SelectionDecision;
}

export function selectDeliveryCandidate(input: {
  candidates: readonly DeliveryCandidate[];
  placementCode: PlacementCode;
  context: TargetingContext;
  now: Date;
  featureEnabled: boolean;
  globalKill: boolean;
  placementEnabled: boolean;
  minimumPublisherContentChars: number;
  requestId: string;
}): {
  selected: DeliveryCandidate | null;
  evaluations: CandidateEvaluation[];
} {
  const evaluations = input.candidates
    .filter((candidate) => candidate.placementCode === input.placementCode)
    .map((candidate) => ({
      candidate,
      decision: evaluateEligibility({
        featureEnabled: input.featureEnabled,
        globalKill: input.globalKill,
        placementEnabled: input.placementEnabled,
        minimumPublisherContentChars: input.minimumPublisherContentChars,
        lineItem: candidate,
        context: input.context,
        now: input.now,
        frequencyCapped: candidate.frequencyCapped,
        pacingAllowsDelivery: candidate.pacingAllowsDelivery,
      }),
    }));

  const eligible = evaluations
    .filter((evaluation) => evaluation.decision.eligible)
    .map((evaluation) => evaluation.candidate)
    .sort((left, right) => {
      if (left.priority !== right.priority) return right.priority - left.priority;
      if (left.pacingAllowsDelivery !== right.pacingAllowsDelivery) {
        return left.pacingAllowsDelivery ? -1 : 1;
      }
      return left.id.localeCompare(right.id);
    });

  if (eligible.length === 0) return { selected: null, evaluations };
  const topPriority = eligible[0]?.priority;
  const tier = eligible.filter((candidate) => candidate.priority === topPriority);
  const totalWeight = tier.reduce(
    (sum, candidate) => sum + Math.max(1, candidate.creativeWeight),
    0,
  );
  let point = stableHash(input.requestId) % totalWeight;
  for (const candidate of tier) {
    point -= Math.max(1, candidate.creativeWeight);
    if (point < 0) return { selected: candidate, evaluations };
  }
  return { selected: tier[0] ?? null, evaluations };
}

export function reconcileBillingEvents(input: {
  rawEventIds: readonly string[];
  validatedEventIds: readonly string[];
  invalidEventIds: readonly string[];
}): {
  rawEvents: number;
  validatedEvents: number;
  billableEventIds: string[];
  duplicateIds: string[];
} {
  const raw = new Set(input.rawEventIds);
  const invalid = new Set(input.invalidEventIds);
  const validated = new Set<string>();
  const duplicateIds: string[] = [];
  for (const eventId of input.validatedEventIds) {
    if (validated.has(eventId)) duplicateIds.push(eventId);
    if (raw.has(eventId)) validated.add(eventId);
  }
  const billableEventIds = [...validated].filter((eventId) => !invalid.has(eventId));
  return {
    rawEvents: raw.size,
    validatedEvents: validated.size,
    billableEventIds,
    duplicateIds,
  };
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

