import type { EditorialClaim } from "./claims";
import type { EditorialSource } from "./source-tiers";
import type {
  ArticleFormat,
  EditorialState,
  StoryCategory,
} from "./types";

export const DEMO_CONTENT_DISCLAIMER =
  "Fictional demo content for product development. It does not describe a real event, person, company, or emergency.";

export interface DemoNamedEntity {
  readonly id: string;
  readonly name: string;
  readonly kind: "ORGANIZATION" | "PRODUCT" | "TEAM" | "PLACE" | "PROGRAM";
  readonly isFictional: true;
}

export interface DemoStorySeed {
  readonly id: string;
  readonly isDemo: true;
  readonly disclaimer: typeof DEMO_CONTENT_DISCLAIMER;
  readonly title: string;
  readonly slug: string;
  readonly summary: string;
  readonly category: StoryCategory;
  readonly format: ArticleFormat;
  readonly editorialState: EditorialState;
  readonly entityIds: readonly string[];
  readonly sourceIds: readonly string[];
  readonly claimIds: readonly string[];
  readonly publishedAt?: string;
  readonly correctionNote?: string;
}

export interface DemoTrendSeed {
  readonly id: string;
  readonly isDemo: true;
  readonly originalTerm: string;
  readonly relatedTerms: readonly string[];
  readonly entityIds: readonly string[];
  readonly market: "US";
  readonly firstDetectedAt: string;
  readonly latestDetectedAt: string;
}

export const DEMO_ENTITIES = [
  {
    id: "demo-org-aster-loop",
    name: "Aster Loop Labs (fictional)",
    kind: "ORGANIZATION",
    isFictional: true,
  },
  {
    id: "demo-product-luma-one",
    name: "Luma One Earbuds (fictional)",
    kind: "PRODUCT",
    isFictional: true,
  },
  {
    id: "demo-org-harborlight",
    name: "Harborlight Observatory (fictional)",
    kind: "ORGANIZATION",
    isFictional: true,
  },
  {
    id: "demo-program-helio-seven",
    name: "Helio Seven Survey (fictional)",
    kind: "PROGRAM",
    isFictional: true,
  },
  {
    id: "demo-team-metrovale-comets",
    name: "Metrovale Comets (fictional)",
    kind: "TEAM",
    isFictional: true,
  },
  {
    id: "demo-team-lakeford-arrows",
    name: "Lakeford Arrows (fictional)",
    kind: "TEAM",
    isFictional: true,
  },
  {
    id: "demo-place-metrovale",
    name: "Metrovale (fictional)",
    kind: "PLACE",
    isFictional: true,
  },
] as const satisfies readonly DemoNamedEntity[];

export const DEMO_SOURCES = [
  {
    id: "demo-source-aster-loop-pressroom",
    name: "Aster Loop Labs Demo Pressroom",
    domain: "aster-loop.example",
    publisherGroupId: "demo-publisher-aster-loop",
    countryCode: "US",
    sourceType: "OFFICIAL_STATEMENT",
    identityVerified: true,
    followsProfessionalStandards: false,
    isPrimaryEvidence: true,
    citationRequirement: "Name the fictional company and label the item as demo content.",
    licensingStatus: "PERMITTED",
    lastReviewedAt: "2000-01-01T12:00:00.000Z",
    historicalReliabilityNotes: "Reserved .example source used only by the demo dataset.",
  },
  {
    id: "demo-source-harborlight-data",
    name: "Harborlight Observatory Demo Data Archive",
    domain: "harborlight-observatory.example",
    publisherGroupId: "demo-publisher-harborlight",
    countryCode: "US",
    sourceType: "OFFICIAL_DATA",
    identityVerified: true,
    followsProfessionalStandards: true,
    isPrimaryEvidence: true,
    citationRequirement: "Label the dataset and all derived claims as fictional.",
    licensingStatus: "ATTRIBUTION_REQUIRED",
    lastReviewedAt: "2000-01-01T12:00:00.000Z",
  },
  {
    id: "demo-source-science-desk",
    name: "North Coast Demo Science Desk",
    domain: "north-coast-science.example",
    publisherGroupId: "demo-publisher-north-coast",
    countryCode: "US",
    sourceType: "SPECIALIST_PUBLICATION",
    identityVerified: true,
    followsProfessionalStandards: true,
    isPrimaryEvidence: false,
    citationRequirement: "Link to the fictional analysis and identify it as demo material.",
    licensingStatus: "ATTRIBUTION_REQUIRED",
    lastReviewedAt: "2000-01-01T12:00:00.000Z",
  },
  {
    id: "demo-source-metrovale-league",
    name: "Metrovale Demo League",
    domain: "metrovale-league.example",
    publisherGroupId: "demo-publisher-metrovale-league",
    countryCode: "US",
    sourceType: "OFFICIAL_DATA",
    identityVerified: true,
    followsProfessionalStandards: true,
    isPrimaryEvidence: true,
    citationRequirement: "Identify this as a fictional result feed.",
    licensingStatus: "PERMITTED",
    lastReviewedAt: "2000-01-01T12:00:00.000Z",
  },
  {
    id: "demo-source-metrovale-desk",
    name: "Metrovale Demo Sports Desk",
    domain: "metrovale-sports.example",
    publisherGroupId: "demo-publisher-metrovale-desk",
    countryCode: "US",
    sourceType: "LOCAL_NEWSROOM",
    identityVerified: true,
    followsProfessionalStandards: true,
    isPrimaryEvidence: false,
    citationRequirement: "Attribute the fictional game report.",
    licensingStatus: "ATTRIBUTION_REQUIRED",
    lastReviewedAt: "2000-01-01T12:00:00.000Z",
  },
] as const satisfies readonly EditorialSource[];

export const DEMO_CLAIMS = [
  {
    id: "demo-claim-luma-offline",
    text: "The fictional Luma One demonstration processed its sample translations on the device.",
    articleSection: "What happened",
    category: "PRODUCT_CAPABILITY",
    isCentral: true,
    supportingSourceIds: ["demo-source-aster-loop-pressroom"],
    contradictingSourceIds: [],
    primaryEvidenceAvailable: true,
    observedAt: "2000-01-02T14:00:00.000Z",
    verificationStatus: "VERIFIED_BY_PRIMARY_SOURCE",
    riskLevel: "LOW",
    reviewerId: "demo-reviewer",
    reviewNotes: "Verified only within the explicitly fictional demo record.",
  },
  {
    id: "demo-claim-helio-cadence",
    text: "The fictional Helio Seven survey published a seven-night observation sequence.",
    articleSection: "By the numbers",
    category: "RESEARCH_RELEASE",
    isCentral: true,
    supportingSourceIds: [
      "demo-source-harborlight-data",
      "demo-source-science-desk",
    ],
    contradictingSourceIds: [],
    primaryEvidenceAvailable: true,
    observedAt: "2000-01-03T16:00:00.000Z",
    verificationStatus: "VERIFIED_BY_PRIMARY_SOURCE",
    riskLevel: "LOW",
    reviewerId: "demo-reviewer",
    reviewNotes: "Primary demo dataset and independent fictional analysis agree.",
  },
  {
    id: "demo-claim-comets-score",
    text: "The fictional Comets–Arrows result feed lists the Comets as the winner.",
    articleSection: "Final result",
    category: "SPORTS_RESULT",
    isCentral: true,
    supportingSourceIds: [
      "demo-source-metrovale-league",
      "demo-source-metrovale-desk",
    ],
    contradictingSourceIds: [],
    primaryEvidenceAvailable: true,
    observedAt: "2000-01-04T22:00:00.000Z",
    verificationStatus: "VERIFIED_BY_PRIMARY_SOURCE",
    riskLevel: "LOW",
    reviewerId: "demo-reviewer",
    reviewNotes: "The correction changes only the fictional start time, not the result.",
  },
] as const satisfies readonly EditorialClaim[];

export const DEMO_TRENDS = [
  {
    id: "demo-trend-luma-one",
    isDemo: true,
    originalTerm: "Luma One offline translation demo",
    relatedTerms: ["Aster Loop earbuds", "on-device translation demo"],
    entityIds: ["demo-org-aster-loop", "demo-product-luma-one"],
    market: "US",
    firstDetectedAt: "2000-01-02T13:30:00.000Z",
    latestDetectedAt: "2000-01-02T15:00:00.000Z",
  },
  {
    id: "demo-trend-helio-seven",
    isDemo: true,
    originalTerm: "Helio Seven observation release",
    relatedTerms: ["Harborlight Observatory dataset"],
    entityIds: ["demo-org-harborlight", "demo-program-helio-seven"],
    market: "US",
    firstDetectedAt: "2000-01-03T15:00:00.000Z",
    latestDetectedAt: "2000-01-03T18:00:00.000Z",
  },
] as const satisfies readonly DemoTrendSeed[];

export const DEMO_STORIES = [
  {
    id: "demo-story-luma-one",
    isDemo: true,
    disclaimer: DEMO_CONTENT_DISCLAIMER,
    title: "[DEMO] Aster Loop previews offline translation earbuds",
    slug: "demo-aster-loop-offline-translation-earbuds",
    summary:
      "A fictional product brief showing how a low-risk launch can connect a primary claim to its source.",
    category: "TECHNOLOGY",
    format: "QUICK_BRIEF",
    editorialState: "PUBLISHED",
    entityIds: ["demo-org-aster-loop", "demo-product-luma-one"],
    sourceIds: ["demo-source-aster-loop-pressroom"],
    claimIds: ["demo-claim-luma-offline"],
    publishedAt: "2000-01-02T16:00:00.000Z",
  },
  {
    id: "demo-story-helio-seven",
    isDemo: true,
    disclaimer: DEMO_CONTENT_DISCLAIMER,
    title: "[DEMO] What the Helio Seven observation sequence would measure",
    slug: "demo-helio-seven-observation-explainer",
    summary:
      "A fictional science explainer backed by a demo primary dataset and an independent demo specialist source.",
    category: "SCIENCE",
    format: "DEEP_EXPLAINER",
    editorialState: "DEVELOPING",
    entityIds: ["demo-org-harborlight", "demo-program-helio-seven"],
    sourceIds: [
      "demo-source-harborlight-data",
      "demo-source-science-desk",
    ],
    claimIds: ["demo-claim-helio-cadence"],
    publishedAt: "2000-01-03T19:00:00.000Z",
  },
  {
    id: "demo-story-comets-result",
    isDemo: true,
    disclaimer: DEMO_CONTENT_DISCLAIMER,
    title: "[DEMO] Metrovale Comets finish ahead of Lakeford Arrows",
    slug: "demo-comets-arrows-result",
    summary:
      "A fictional sports result with a visible correction demonstrating preserved update history.",
    category: "SPORTS",
    format: "STANDARD_NEWS",
    editorialState: "CORRECTED",
    entityIds: [
      "demo-team-metrovale-comets",
      "demo-team-lakeford-arrows",
    ],
    sourceIds: [
      "demo-source-metrovale-league",
      "demo-source-metrovale-desk",
    ],
    claimIds: ["demo-claim-comets-score"],
    publishedAt: "2000-01-04T22:30:00.000Z",
    correctionNote:
      "Demo correction: an earlier fictional version listed the start time one hour late.",
  },
  {
    id: "demo-story-emergency-exercise",
    isDemo: true,
    disclaimer: DEMO_CONTENT_DISCLAIMER,
    title: "[DEMO EXERCISE — NOT A REAL EMERGENCY] Metrovale response drill",
    slug: "demo-metrovale-response-drill",
    summary:
      "A newsroom training record showing that emergency-style coverage remains blocked for human review even in a demo.",
    category: "US_NEWS",
    format: "LIVE_BLOG",
    editorialState: "HUMAN_REVIEW_REQUIRED",
    entityIds: ["demo-place-metrovale"],
    sourceIds: [],
    claimIds: [],
  },
] as const satisfies readonly DemoStorySeed[];
