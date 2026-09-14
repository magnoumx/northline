import type { EditorialEmbedProvider } from "../media/editorial-embeds";

export type StoryStatus = "Verified" | "Developing" | "Live" | "Updated";

export type StoryFormat =
  | "Quick Brief"
  | "Standard"
  | "Deep Explainer"
  | "Live Blog"
  | "Why Trending";

export type SourceRecord = {
  id: string;
  /**
   * Where the citation points. An exact external document is preferred so the
   * reader can open the page that supports the claim; the internal publisher
   * profile remains the fallback for records without a stored document.
   */
  locator: `/sources/${string}` | `https://${string}`;
  name: string;
  kind: "Primary" | "Independent" | "Context";
  tier: 1 | 2 | 3;
  note: string;
};

export type TimelineItem = {
  time: string;
  title: string;
  detail: string;
  status: "confirmed" | "context" | "watching";
};

export type Story = {
  id?: string;
  slug: string;
  category: string;
  eyebrow: string;
  headline: string;
  dek: string;
  summary: string;
  status: StoryStatus;
  format: StoryFormat;
  published: string;
  updated: string;
  publishedAtIso?: string;
  updatedAtIso?: string;
  canonicalPath?: string;
  isDemo?: boolean;
  readTime: number;
  image: string;
  imageAlt: string;
  imageCredit: string;
  /** Exact page the image came from, so attribution can be clickable. */
  imageSourceUrl?: string;
  imageLicense?: string;
  imageLicenseUrl?: string;
  videoEmbedUrl?: string;
  videoTitle?: string;
  videoProvider?: EditorialEmbedProvider;
  videoSourceUrl?: string;
  videoAspect?: "landscape" | "portrait" | "social";
  accent: "coral" | "blue" | "gold" | "green" | "violet";
  score: number;
  trend: number;
  author: string;
  /** Null unless a real human review record exists. Never a placeholder. */
  reviewer: string | null;
  /** Sentence describing how this article was actually produced. */
  workflowStatement?: string;
  humanReviewed?: boolean;
  topics: string[];
  /** Queries the SEO stage produced, used to build structured-data keywords. */
  searchQueries?: string[];
  whyItMatters: string;
  whyTrending: string;
  keyFacts: string[];
  body: Array<{
    heading?: string;
    paragraphs: string[];
  }>;
  timeline: TimelineItem[];
  /**
   * Imagery placed between body sections. Real photographs of the event belong
   * in the reporting, not only above it.
   */
  inlineMedia?: Array<{
    url: string;
    alt: string;
    caption: string;
    sourceUrl?: string;
    license?: string;
    licenseUrl?: string;
    afterSection: number;
  }>;
  sources: SourceRecord[];
  uncertainties: string[];
  next: string;
};

export type Trend = {
  id?: string;
  rank: number;
  term: string;
  category: string;
  velocity: number;
  score?: number;
  state?: string;
  risk?: string;
  latestDetectedAt?: string;
  observationCount?: number;
  sourceFamilies?: string[];
  regions: string[];
  explanation: string;
  confidence: "High" | "Medium";
  related: string[];
  storySlug?: string;
};
