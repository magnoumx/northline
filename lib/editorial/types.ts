export const ARTICLE_FORMATS = [
  "NEWS_FLASH",
  "QUICK_BRIEF",
  "STANDARD_NEWS",
  "DEEP_EXPLAINER",
  "LIVE_BLOG",
  "WHY_TRENDING",
  "VISUAL_STORY",
  "SOURCE_COMPARISON",
] as const;

export type ArticleFormat = (typeof ARTICLE_FORMATS)[number];

export const STORY_CATEGORIES = [
  "US_NEWS",
  "POLITICS",
  "TECHNOLOGY",
  "BUSINESS",
  "ENTERTAINMENT",
  "SPORTS",
  "GAMING",
  "SCIENCE",
  "INTERNET_TRENDS",
  "WORLD",
  "HEALTH",
  "FINANCE",
  "WEATHER",
] as const;

export type StoryCategory = (typeof STORY_CATEGORIES)[number];

export const EDITORIAL_STATES = [
  "SIGNAL_DETECTED",
  "NORMALIZED",
  "CLUSTERED",
  "CANDIDATE",
  "REJECTED_EARLY",
  "RESEARCHING",
  "SOURCE_INSUFFICIENT",
  "RESEARCH_COMPLETE",
  "OUTLINING",
  "DRAFTING",
  "CLAIM_EXTRACTION",
  "FACT_REVIEW",
  "COPY_REVIEW",
  "SEO_REVIEW",
  "MEDIA_REVIEW",
  "RISK_REVIEW",
  "REVISION_REQUIRED",
  "HUMAN_REVIEW_REQUIRED",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
  "DEVELOPING",
  "UPDATED",
  "CORRECTED",
  "RETRACTED",
  "ARCHIVED",
] as const;

export type EditorialState = (typeof EDITORIAL_STATES)[number];

export type EditorialActorType =
  | "SYSTEM"
  | "EDITOR"
  | "REVIEWER"
  | "PUBLISHER";

export interface EditorialActor {
  readonly id: string;
  readonly type: EditorialActorType;
}

export function assertNever(value: never, message: string): never {
  throw new Error(`${message}: ${String(value)}`);
}
