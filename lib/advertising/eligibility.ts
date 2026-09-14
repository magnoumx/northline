import type {
  EligibleLineItem,
  SelectionDecision,
  TargetingContext,
  TargetingPolicy,
} from "./types";

const suppressedPageClasses = new Set([
  "LOGIN",
  "ACCOUNT",
  "ERROR",
  "EMPTY",
  "CORRECTION_ONLY",
  "RETRACTED_STORY",
  "ADMIN",
  "PREVIEW",
  "SENSITIVE_TRAGEDY",
]);

export function targetMatches(
  policy: TargetingPolicy,
  context: TargetingContext,
): boolean {
  if (policy.sensitiveTraits.length > 0) return false;
  if (policy.excludedSensitiveContent && context.sensitive) return false;
  if (
    policy.countries.length > 0 &&
    !policy.countries.includes(context.country.toUpperCase())
  ) {
    return false;
  }
  if (policy.devices.length > 0 && !policy.devices.includes(context.device)) {
    return false;
  }
  if (
    policy.categories.length > 0 &&
    (!context.category ||
      !policy.categories.some(
        (category) => category.toLowerCase() === context.category?.toLowerCase(),
      ))
  ) {
    return false;
  }
  return !policy.excludedPages.some((pattern) =>
    pathMatchesPattern(context.pagePath, pattern),
  );
}

export function evaluateEligibility(input: {
  featureEnabled: boolean;
  globalKill: boolean;
  placementEnabled: boolean;
  minimumPublisherContentChars: number;
  lineItem: EligibleLineItem;
  context: TargetingContext;
  now: Date;
  frequencyCapped: boolean;
  pacingAllowsDelivery: boolean;
}): SelectionDecision {
  if (!input.featureEnabled) return deny("FEATURE_DISABLED");
  if (input.globalKill) return deny("GLOBAL_KILL");
  if (!input.placementEnabled || input.lineItem.killed) {
    return deny("PLACEMENT_DISABLED");
  }
  if (suppressedPageClasses.has(input.context.pageClass)) {
    return deny("PAGE_SUPPRESSED");
  }
  if (input.context.publisherContentChars < input.minimumPublisherContentChars) {
    return deny("INSUFFICIENT_CONTENT");
  }
  if (input.context.sensitive) return deny("SENSITIVE_CONTENT");
  if (
    input.now.getTime() < input.lineItem.startsAt.getTime() ||
    input.now.getTime() >= input.lineItem.endsAt.getTime()
  ) {
    return deny("OUTSIDE_SCHEDULE");
  }
  if (!["READY", "DELIVERING"].includes(input.lineItem.status)) {
    return deny("INVALID_STATUS");
  }
  if (!input.lineItem.approved) return deny("NOT_APPROVED");
  if (input.lineItem.creativeVersionIds.length === 0) {
    return deny("NO_APPROVED_CREATIVE");
  }
  if (!targetMatches(input.lineItem.target, input.context)) {
    return deny("TARGET_MISMATCH");
  }
  if (input.frequencyCapped) return deny("FREQUENCY_CAPPED");
  if (!input.pacingAllowsDelivery) return deny("PACING_HELD");
  return { eligible: true, reason: "ELIGIBLE" };
}

function deny(reason: Exclude<SelectionDecision["reason"], "ELIGIBLE">) {
  return { eligible: false, reason } as const;
}

function pathMatchesPattern(path: string, pattern: string): boolean {
  const normalized = pattern.trim();
  if (!normalized) return false;
  if (normalized.endsWith("*")) return path.startsWith(normalized.slice(0, -1));
  return path === normalized;
}

