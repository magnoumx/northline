export const pricingModels = [
  "FLAT_FEE",
  "CPD",
  "CPM",
  "VIEWABLE_CPM",
  "CPC",
  "SPONSORSHIP_SHARE",
  "NEWSLETTER_FLAT_FEE",
  "SPONSORED_CONTENT_FEE",
] as const;

export type PricingModel = (typeof pricingModels)[number];

export const lineItemStatuses = [
  "DRAFT",
  "PENDING_REVIEW",
  "CHANGES_REQUIRED",
  "APPROVED",
  "READY",
  "DELIVERING",
  "PAUSED",
  "COMPLETED",
  "UNDERDELIVERED",
  "CANCELLED",
  "REJECTED",
] as const;

export type LineItemStatus = (typeof lineItemStatuses)[number];

export const placementCodes = [
  "HOME_LEADERBOARD",
  "HOME_INLINE_NATIVE",
  "HOME_SIDEBAR",
  "LATEST_INLINE",
  "TRENDING_SPONSOR",
  "ARTICLE_TOP",
  "ARTICLE_INLINE_1",
  "ARTICLE_INLINE_2",
  "ARTICLE_END",
  "ARTICLE_SIDEBAR",
  "CATEGORY_LEADERBOARD",
  "CATEGORY_SPONSOR",
  "NEWSLETTER_HEADER",
  "NEWSLETTER_INLINE",
  "NEWSLETTER_FOOTER",
  "SPONSORED_COLLECTION",
] as const;

export type PlacementCode = (typeof placementCodes)[number];

export type DeviceClass = "MOBILE" | "TABLET" | "DESKTOP" | "UNKNOWN";

export interface TargetingContext {
  country: string;
  device: DeviceClass;
  category?: string;
  pagePath: string;
  pageClass: string;
  sensitive: boolean;
  publisherContentChars: number;
}

export interface TargetingPolicy {
  countries: readonly string[];
  devices: readonly DeviceClass[];
  categories: readonly string[];
  excludedPages: readonly string[];
  excludedSensitiveContent: boolean;
  sensitiveTraits: readonly string[];
}

export interface EligibleLineItem {
  id: string;
  campaignId: string;
  placementCode: PlacementCode;
  status: LineItemStatus;
  startsAt: Date;
  endsAt: Date;
  priority: number;
  pacing: "EVEN" | "ASAP";
  target: TargetingPolicy;
  creativeVersionIds: readonly string[];
  approved: boolean;
  killed: boolean;
}

export interface SelectionDecision {
  eligible: boolean;
  reason:
    | "ELIGIBLE"
    | "FEATURE_DISABLED"
    | "GLOBAL_KILL"
    | "PLACEMENT_DISABLED"
    | "PAGE_SUPPRESSED"
    | "INSUFFICIENT_CONTENT"
    | "SENSITIVE_CONTENT"
    | "OUTSIDE_SCHEDULE"
    | "INVALID_STATUS"
    | "NOT_APPROVED"
    | "NO_APPROVED_CREATIVE"
    | "TARGET_MISMATCH"
    | "FREQUENCY_CAPPED"
    | "PACING_HELD";
}

