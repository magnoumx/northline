export const intelligenceViews = [
  "overview",
  "top-content",
  "headlines",
  "formats",
  "publishers",
  "opportunities",
] as const;

export type IntelligenceView = (typeof intelligenceViews)[number];

export const intelligenceCountries = [
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "GB", label: "United Kingdom" },
  { code: "AU", label: "Australia" },
] as const;

export type IntelligenceCountry =
  (typeof intelligenceCountries)[number]["code"];

export const intelligenceWindows = [
  "4h",
  "12h",
  "24h",
  "7d",
  "30d",
  "12mo",
  "custom",
] as const;

export type IntelligenceWindow = (typeof intelligenceWindows)[number];

export type TrendMetric =
  | "RELATIVE_SEARCH_INTEREST"
  | "ESTIMATED_MONTHLY_SEARCHES"
  | "OWN_SITE_IMPRESSIONS"
  | "OWN_SITE_CLICKS"
  | "PUBLIC_SOCIAL_SIGNALS"
  | "ESTIMATED_TRAFFIC";

export type TrendSignal = {
  id: string;
  topic: string;
  originalQuery: string;
  country: IntelligenceCountry;
  region: string | null;
  language: string;
  category: string;
  relatedEntities: readonly string[];
  firstDetectedLabel: string;
  lastDetectedLabel: string;
  peakTimeLabel: string;
  relativeSearchInterest: number;
  estimatedMonthlySearches: null;
  searchGrowthPercent: number;
  newsSourceVelocity: "LOW" | "MEDIUM" | "HIGH";
  socialVelocity: "UNKNOWN_NOT_CONNECTED";
  videoVelocity: "UNKNOWN_NOT_CONNECTED";
  wikipediaInterest: "UNKNOWN_NOT_CONNECTED";
  relatedQueries: readonly string[];
  risingQueries: readonly string[];
  primarySourceAvailability: "LOW" | "MEDIUM" | "HIGH";
  imageAvailability: "UNKNOWN_NOT_REVIEWED";
  videoAvailability: "UNKNOWN_NOT_REVIEWED";
  existingStoryCluster: string | null;
  existingSiteCoverage: "NONE" | "PARTIAL" | "CURRENT";
  competition: "LOW" | "MEDIUM" | "HIGH";
  freshness: "FAST" | "DAILY" | "EVERGREEN";
  risk: "LOW" | "MEDIUM" | "HIGH";
  commercialSuitability: "NOT_EVALUATED";
  recommendedFormat: EditorialFormat;
  recommendedDeadline: string;
  expectedLifespan: string;
  explanation: string;
  metricSource: "SYNTHETIC_V4_FIXTURE";
  metricConfidence: "DEMO_ONLY";
  sourceFamilies: number;
  provenance: string;
};

export type TrendSnapshot = {
  country: IntelligenceCountry;
  window: IntelligenceWindow;
  metric: TrendMetric;
  metricLabel: string;
  metricDefinition: string;
  generatedAtLabel: string;
  provenanceLabel: string;
  signals: readonly TrendSignal[];
};

export type HighSignalSampleRecord = {
  id: string;
  url: string;
  publisherLabel: string;
  country: string;
  language: string;
  headlineLabel: string;
  deck: string;
  authorLabel: string;
  publicationDateLabel: string;
  lastUpdateLabel: string;
  topic: string;
  category: string;
  publisherId: string;
  detectedTrend: string;
  searchIntent: "INFORMATIONAL" | "SERVICE" | "EXPLANATORY";
  estimatedDemandClass: "LOW" | "MEDIUM" | "HIGH";
  publicRankingPosition: number | null;
  wordCount: number;
  readingTimeMinutes: number;
  openingStyle: "DIRECT_LEDE" | "SCENE_SETTER" | "QUESTION_ANSWER";
  headlinePattern: string;
  sectionCount: number;
  paragraphCount: number;
  imageCount: number;
  videoCount: number;
  chartCount: number;
  tableCount: number;
  faqPresent: boolean;
  timelinePresent: boolean;
  sourceVisibility: "LOW" | "MEDIUM" | "HIGH";
  internalLinkCount: number;
  externalSourceCount: number;
  structuredDataTypes: readonly string[];
  newsletterCtaPosition: "NONE" | "MID_ARTICLE" | "END";
  advertisementDensity: "NONE" | "LOW" | "MEDIUM";
  updateFrequency: "ONCE" | "DAILY" | "LIVE";
  format: EditorialFormat;
  freshnessModel: "BREAKING" | "DAILY" | "EVERGREEN";
  publicEngagementSignals: readonly {
    metric: "FIXTURE_RELATIVE_ATTENTION_INDEX";
    value: number;
  }[];
  knownMetricLimitations: readonly string[];
  publishedDay: number;
  relativeAttentionIndex: number;
  derivedEngagementBand: "LOW" | "MEDIUM" | "HIGH";
  provenance: "SYNTHETIC_DERIVED_METADATA";
};

export type PublisherConnector = {
  id: string;
  label: string;
  sourceFamily:
    | "WIRE"
    | "PUBLIC_BROADCASTER"
    | "NATIONAL"
    | "REGIONAL"
    | "LOCAL"
    | "SPECIALIST";
  geography: string;
  publicMetadataOnly: true;
  rightsPolicy: "LINK_AND_DERIVED_METADATA_ONLY";
  schedule: string;
  sampleRecordCount: number;
  status: "DEMO_CONFIGURATION";
};

export type IntelligenceConnector = {
  id: string;
  label: string;
  connectorType:
    | "PUBLIC_MOST_READ"
    | "PUBLIC_TRENDING"
    | "GOOGLE_TRENDS"
    | "GOOGLE_NEWS"
    | "BING_TRENDS"
    | "REDDIT_API"
    | "WIKIPEDIA_PAGEVIEWS"
    | "YOUTUBE_DATA_API"
    | "LICENSED_NEWS_API"
    | "SEARCH_CONSOLE"
    | "GOOGLE_ADS_KEYWORDS"
    | "DATAFORSEO"
    | "INTERNAL_ANALYTICS";
  dataBoundary: string;
  termsBoundary: string;
  refreshClass: "FAST" | "FOUR_HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY";
  status: "NOT_CONFIGURED";
  requiresCredential: boolean;
  optional: boolean;
};

export const editorialFormats = [
  "NEWS_FLASH",
  "QUICK_BRIEF",
  "STANDARD_STORY",
  "DEEP_EXPLAINER",
  "ULTIMATE_GUIDE",
  "LIVE_COVERAGE",
] as const;

export type EditorialFormat = (typeof editorialFormats)[number];

export type FormatRecommendationInput = {
  urgency: "LOW" | "MEDIUM" | "HIGH";
  evidenceCount: number;
  eventCount: number;
  publicActionability: boolean;
  analyticalDepth: boolean;
  evolving: boolean;
};

export type FormatRecommendation = {
  format: EditorialFormat;
  targetWords: readonly [number, number] | null;
  rationale: string;
  noPaddingRule: string;
};

export const opportunityStates = [
  "REJECT",
  "WATCH",
  "RESEARCH",
  "QUICK_BRIEF",
  "STANDARD_STORY",
  "DEEP_EXPLAINER",
  "LIVE_COVERAGE",
  "VISUAL_STORY",
  "VIDEO_STORY",
  "UPDATE_EXISTING_STORY",
] as const;

export type OpportunityState = (typeof opportunityStates)[number];

export type OpportunitySignal = {
  id: string;
  topic: string;
  searchMomentum: number;
  unitedStatesRelevance: number;
  newsImportance: number;
  sourceStrength: number;
  originalValueOpportunity: number;
  visualPotential: number;
  videoPotential: number;
  readerUtility: number;
  existingSiteAuthority: number;
  commercialSuitability: number;
  freshness: number;
  expectedLifespan: number;
  updatePotential: number;
  competitionPenalty: number;
  verificationDifficultyPenalty: number;
  legalRiskPenalty: number;
  copyrightRiskPenalty: number;
  duplicateRiskPenalty: number;
  sensationalismRiskPenalty: number;
  sourceFamilies: number;
  evolving: boolean;
  existingCoverage: boolean;
};

export type ScoredOpportunity = {
  id: string;
  topic: string;
  state: OpportunityState;
  internalScore: number;
  reasons: readonly string[];
  cautions: readonly string[];
  recommendedFormat: EditorialFormat;
  disclosure: "FICTIONAL_INTERNAL_DEMO";
};

export type PublicOpportunity = Omit<
  ScoredOpportunity,
  "internalScore" | "reasons" | "cautions" | "disclosure"
>;

export type HeadlineStrategy =
  | "DIRECT"
  | "EXPLANATORY"
  | "SERVICE"
  | "CONTEXT"
  | "QUESTION_ANSWERED"
  | "TIMELINE";

export type HeadlineCandidate = {
  id: string;
  text: string;
  strategy: HeadlineStrategy;
  clarity: number;
  specificity: number;
  accuracy: number;
  usefulness: number;
  internalScore: number;
  hardRejectReason: string | null;
  disclosure: "FICTIONAL_INTERNAL_DEMO";
};

export type KnowledgeEntity = {
  id: string;
  label: string;
  type:
    | "PERSON"
    | "ORGANIZATION"
    | "COMPANY"
    | "PRODUCT"
    | "GOVERNMENT_AGENCY"
    | "LOCATION"
    | "SPORTS_TEAM"
    | "LEAGUE"
    | "EVENT"
    | "MOVIE"
    | "TV_SHOW"
    | "GAME"
    | "TECHNOLOGY"
    | "TOPIC";
  context: string;
};

export type KnowledgeStory = {
  id: string;
  title: string;
  path: string;
  entityIds: readonly string[];
  publishedAtLabel: string;
};

export type InternalLinkSuggestion = {
  id: string;
  sourceStoryId: string;
  targetStoryId: string;
  anchorText: string;
  insertionContext: string;
  sharedEntityIds: readonly string[];
  confidence: number;
  reasons: readonly string[];
  status: "SUGGESTED" | "REVIEWED" | "REJECTED";
  disclosure: "FICTIONAL_INTERNAL_DEMO";
};

export type IntelligenceDemoViewModel = {
  sampleLabel: "High-Signal Article Sample";
  sampleDisclosure: string;
  sample: readonly HighSignalSampleRecord[];
  trendSnapshots: Readonly<
    Record<
      IntelligenceCountry,
      Readonly<Record<IntelligenceWindow, TrendSnapshot>>
    >
  >;
  publishers: readonly PublisherConnector[];
  connectors: readonly IntelligenceConnector[];
  opportunities: readonly ScoredOpportunity[];
  formats: readonly FormatRecommendation[];
  headlines: readonly HeadlineCandidate[];
  entities: readonly KnowledgeEntity[];
  stories: readonly KnowledgeStory[];
  linkSuggestions: readonly InternalLinkSuggestion[];
};
