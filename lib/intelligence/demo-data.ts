import { getFormatCatalog } from "./format-recommender";
import { generateHeadlineCandidates } from "./headline-lab";
import { suggestInternalLinks } from "./knowledge-graph";
import { scoreOpportunity } from "./opportunity-engine";
import { buildTrendSnapshot } from "./trend-intelligence";
import {
  intelligenceCountries,
  intelligenceWindows,
  type EditorialFormat,
  type HighSignalSampleRecord,
  type IntelligenceCountry,
  type IntelligenceDemoViewModel,
  type IntelligenceConnector,
  type IntelligenceWindow,
  type KnowledgeEntity,
  type KnowledgeStory,
  type OpportunitySignal,
  type PublisherConnector,
  type TrendSnapshot,
} from "./types";

const publishers: readonly PublisherConnector[] = [
  {
    id: "demo-wire",
    label: "National wire demo",
    sourceFamily: "WIRE",
    geography: "United States",
    publicMetadataOnly: true,
    rightsPolicy: "LINK_AND_DERIVED_METADATA_ONLY",
    schedule: "Configurable · no live schedule connected",
    sampleRecordCount: 15,
    status: "DEMO_CONFIGURATION",
  },
  {
    id: "demo-public-media",
    label: "Public media demo",
    sourceFamily: "PUBLIC_BROADCASTER",
    geography: "United States",
    publicMetadataOnly: true,
    rightsPolicy: "LINK_AND_DERIVED_METADATA_ONLY",
    schedule: "Configurable · no live schedule connected",
    sampleRecordCount: 15,
    status: "DEMO_CONFIGURATION",
  },
  {
    id: "demo-national",
    label: "National desk demo",
    sourceFamily: "NATIONAL",
    geography: "United States",
    publicMetadataOnly: true,
    rightsPolicy: "LINK_AND_DERIVED_METADATA_ONLY",
    schedule: "Configurable · no live schedule connected",
    sampleRecordCount: 15,
    status: "DEMO_CONFIGURATION",
  },
  {
    id: "demo-regional-east",
    label: "Eastern regional demo",
    sourceFamily: "REGIONAL",
    geography: "US East",
    publicMetadataOnly: true,
    rightsPolicy: "LINK_AND_DERIVED_METADATA_ONLY",
    schedule: "Configurable · no live schedule connected",
    sampleRecordCount: 15,
    status: "DEMO_CONFIGURATION",
  },
  {
    id: "demo-regional-west",
    label: "Western regional demo",
    sourceFamily: "REGIONAL",
    geography: "US West",
    publicMetadataOnly: true,
    rightsPolicy: "LINK_AND_DERIVED_METADATA_ONLY",
    schedule: "Configurable · no live schedule connected",
    sampleRecordCount: 15,
    status: "DEMO_CONFIGURATION",
  },
  {
    id: "demo-local",
    label: "Local reporting demo",
    sourceFamily: "LOCAL",
    geography: "Selected US metros",
    publicMetadataOnly: true,
    rightsPolicy: "LINK_AND_DERIVED_METADATA_ONLY",
    schedule: "Configurable · no live schedule connected",
    sampleRecordCount: 15,
    status: "DEMO_CONFIGURATION",
  },
  {
    id: "demo-policy",
    label: "Policy specialist demo",
    sourceFamily: "SPECIALIST",
    geography: "United States",
    publicMetadataOnly: true,
    rightsPolicy: "LINK_AND_DERIVED_METADATA_ONLY",
    schedule: "Configurable · no live schedule connected",
    sampleRecordCount: 15,
    status: "DEMO_CONFIGURATION",
  },
  {
    id: "demo-business",
    label: "Business specialist demo",
    sourceFamily: "SPECIALIST",
    geography: "United States",
    publicMetadataOnly: true,
    rightsPolicy: "LINK_AND_DERIVED_METADATA_ONLY",
    schedule: "Configurable · no live schedule connected",
    sampleRecordCount: 15,
    status: "DEMO_CONFIGURATION",
  },
] as const;

const connectors: readonly IntelligenceConnector[] = [
  {
    id: "public-most-read",
    label: "Publisher public Most Read pages",
    connectorType: "PUBLIC_MOST_READ",
    dataBoundary: "Public URL, rank, headline, timestamps, and permitted metadata only",
    termsBoundary: "Per-publisher allowlist, robots, rate, and license review required",
    refreshClass: "FOUR_HOURLY",
    status: "NOT_CONFIGURED",
    requiresCredential: false,
    optional: false,
  },
  {
    id: "public-trending",
    label: "Publisher public Trending pages",
    connectorType: "PUBLIC_TRENDING",
    dataBoundary: "Public rank and metadata only; no article-body collection",
    termsBoundary: "Per-publisher allowlist, robots, rate, and license review required",
    refreshClass: "FOUR_HOURLY",
    status: "NOT_CONFIGURED",
    requiresCredential: false,
    optional: false,
  },
  {
    id: "google-trends",
    label: "Google Trends",
    connectorType: "GOOGLE_TRENDS",
    dataBoundary: "Relative interest, related, and rising query metrics",
    termsBoundary: "Official or licensed access and metric attribution required",
    refreshClass: "FOUR_HOURLY",
    status: "NOT_CONFIGURED",
    requiresCredential: true,
    optional: false,
  },
  {
    id: "google-news",
    label: "Google News topic signals",
    connectorType: "GOOGLE_NEWS",
    dataBoundary: "Topic and public result metadata only",
    termsBoundary: "Use an approved integration; do not scrape restricted results",
    refreshClass: "FAST",
    status: "NOT_CONFIGURED",
    requiresCredential: true,
    optional: false,
  },
  {
    id: "bing-trends",
    label: "Bing trend signals",
    connectorType: "BING_TRENDS",
    dataBoundary: "Available normalized trend metadata only",
    termsBoundary: "Availability, API terms, and attribution must be verified",
    refreshClass: "FOUR_HOURLY",
    status: "NOT_CONFIGURED",
    requiresCredential: true,
    optional: true,
  },
  {
    id: "reddit-api",
    label: "Reddit API",
    connectorType: "REDDIT_API",
    dataBoundary: "Permitted aggregate public-signal metadata; no profile enrichment",
    termsBoundary: "Official API, retention, deletion, and attribution rules apply",
    refreshClass: "FAST",
    status: "NOT_CONFIGURED",
    requiresCredential: true,
    optional: true,
  },
  {
    id: "wikipedia-pageviews",
    label: "Wikipedia page-view data",
    connectorType: "WIKIPEDIA_PAGEVIEWS",
    dataBoundary: "Aggregate page-view series and page identifiers",
    termsBoundary: "Wikimedia API etiquette and attribution apply",
    refreshClass: "DAILY",
    status: "NOT_CONFIGURED",
    requiresCredential: false,
    optional: false,
  },
  {
    id: "youtube-data",
    label: "YouTube Data API",
    connectorType: "YOUTUBE_DATA_API",
    dataBoundary: "Permitted video and channel metadata",
    termsBoundary: "Official API quota, display, storage, and deletion rules apply",
    refreshClass: "DAILY",
    status: "NOT_CONFIGURED",
    requiresCredential: true,
    optional: true,
  },
  {
    id: "licensed-news",
    label: "Licensed news APIs",
    connectorType: "LICENSED_NEWS_API",
    dataBoundary: "Only fields and excerpts permitted by the active license",
    termsBoundary: "Provider-specific license and retention controls required",
    refreshClass: "FAST",
    status: "NOT_CONFIGURED",
    requiresCredential: true,
    optional: true,
  },
  {
    id: "search-console",
    label: "Google Search Console",
    connectorType: "SEARCH_CONSOLE",
    dataBoundary: "Own-site impressions, clicks, position, and query dimensions",
    termsBoundary: "First-party property access and privacy thresholds required",
    refreshClass: "DAILY",
    status: "NOT_CONFIGURED",
    requiresCredential: true,
    optional: false,
  },
  {
    id: "google-ads-keywords",
    label: "Google Ads keyword metrics",
    connectorType: "GOOGLE_ADS_KEYWORDS",
    dataBoundary: "Clearly labeled estimated keyword-demand metrics",
    termsBoundary: "Approved account, API terms, and cost controls required",
    refreshClass: "MONTHLY",
    status: "NOT_CONFIGURED",
    requiresCredential: true,
    optional: true,
  },
  {
    id: "dataforseo",
    label: "DataForSEO",
    connectorType: "DATAFORSEO",
    dataBoundary: "Licensed estimated demand and result metadata",
    termsBoundary: "Optional paid provider; license and budget caps required",
    refreshClass: "MONTHLY",
    status: "NOT_CONFIGURED",
    requiresCredential: true,
    optional: true,
  },
  {
    id: "internal-analytics",
    label: "Internal site analytics",
    connectorType: "INTERNAL_ANALYTICS",
    dataBoundary: "Privacy-safe own-site aggregate events only",
    termsBoundary: "Consent, retention, minimization, and access controls required",
    refreshClass: "DAILY",
    status: "NOT_CONFIGURED",
    requiresCredential: true,
    optional: false,
  },
] as const;

const topics = [
  ["Regional grid plans", "Energy"],
  ["Transit reliability", "Infrastructure"],
  ["Primary care access", "Health"],
  ["Housing permit changes", "Housing"],
  ["School funding", "Education"],
  ["Consumer price shifts", "Economy"],
  ["Small-business credit", "Business"],
  ["Local resilience", "Climate"],
  ["Election administration", "Politics"],
  ["Privacy safeguards", "Technology"],
  ["Water infrastructure", "Environment"],
  ["Emergency staffing", "Public safety"],
] as const;

const sampleFormats: readonly EditorialFormat[] = [
  "NEWS_FLASH",
  "QUICK_BRIEF",
  "STANDARD_STORY",
  "DEEP_EXPLAINER",
  "ULTIMATE_GUIDE",
  "LIVE_COVERAGE",
];

export function buildHighSignalArticleSample(): readonly HighSignalSampleRecord[] {
  return Array.from({ length: 120 }, (_, index) => {
    const [topic, category] = topics[index % topics.length];
    const relativeAttentionIndex = 43 + ((index * 17 + 11) % 56);
    return {
      id: `sample-${String(index + 1).padStart(3, "0")}`,
      url: `https://demo.invalid/high-signal/${index + 1}`,
      publisherLabel:
        publishers[index % publishers.length].label,
      country: "United States",
      language: "English",
      headlineLabel: `${topic}: synthetic metadata record ${index + 1}`,
      deck: `Synthetic deck describing the ${topic.toLowerCase()} fixture.`,
      authorLabel: `Demo desk ${(index % 6) + 1}`,
      publicationDateLabel: `2026-07-${String(1 + (index % 24)).padStart(2, "0")}`,
      lastUpdateLabel: `2026-07-${String(1 + (index % 24)).padStart(2, "0")} fixture`,
      topic,
      category,
      publisherId: publishers[index % publishers.length].id,
      detectedTrend: topic,
      searchIntent:
        index % 3 === 0
          ? "SERVICE"
          : index % 3 === 1
            ? "EXPLANATORY"
            : "INFORMATIONAL",
      estimatedDemandClass:
        relativeAttentionIndex >= 82
          ? "HIGH"
          : relativeAttentionIndex >= 62
            ? "MEDIUM"
            : "LOW",
      publicRankingPosition: index % 4 === 0 ? null : 1 + (index % 20),
      wordCount: 420 + ((index * 137) % 2780),
      readingTimeMinutes: 2 + (index % 13),
      openingStyle:
        index % 3 === 0
          ? "DIRECT_LEDE"
          : index % 3 === 1
            ? "SCENE_SETTER"
            : "QUESTION_ANSWER",
      headlinePattern:
        index % 3 === 0 ? "Direct update" : index % 3 === 1 ? "Explainer" : "Service",
      sectionCount: 2 + (index % 9),
      paragraphCount: 8 + (index % 31),
      imageCount: index % 7,
      videoCount: index % 5 === 0 ? 1 : 0,
      chartCount: index % 6 === 0 ? 1 : 0,
      tableCount: index % 8 === 0 ? 1 : 0,
      faqPresent: index % 4 === 0,
      timelinePresent: index % 6 === 0,
      sourceVisibility: index % 3 === 0 ? "HIGH" : index % 3 === 1 ? "MEDIUM" : "LOW",
      internalLinkCount: 2 + (index % 8),
      externalSourceCount: 1 + (index % 6),
      structuredDataTypes:
        index % 4 === 0 ? ["NewsArticle", "FAQPage"] : ["NewsArticle"],
      newsletterCtaPosition:
        index % 3 === 0 ? "MID_ARTICLE" : index % 3 === 1 ? "END" : "NONE",
      advertisementDensity:
        index % 3 === 0 ? "NONE" : index % 3 === 1 ? "LOW" : "MEDIUM",
      updateFrequency:
        index % 8 === 0 ? "LIVE" : index % 3 === 0 ? "DAILY" : "ONCE",
      format: sampleFormats[index % sampleFormats.length],
      freshnessModel:
        index % 8 === 0 ? "BREAKING" : index % 3 === 0 ? "DAILY" : "EVERGREEN",
      publicEngagementSignals: [
        {
          metric: "FIXTURE_RELATIVE_ATTENTION_INDEX",
          value: relativeAttentionIndex,
        },
      ],
      knownMetricLimitations: [
        "Synthetic fixture value; not observed traffic.",
        "Records are not a definitive internet-wide ranking.",
      ],
      publishedDay: 1 + (index % 30),
      relativeAttentionIndex,
      derivedEngagementBand:
        relativeAttentionIndex >= 82
          ? "HIGH"
          : relativeAttentionIndex >= 62
            ? "MEDIUM"
            : "LOW",
      provenance: "SYNTHETIC_DERIVED_METADATA",
    };
  });
}

const opportunityDefaults: Omit<OpportunitySignal, "id" | "topic"> = {
  searchMomentum: 65,
  unitedStatesRelevance: 78,
  newsImportance: 72,
  sourceStrength: 70,
  originalValueOpportunity: 68,
  visualPotential: 58,
  videoPotential: 44,
  readerUtility: 76,
  existingSiteAuthority: 55,
  commercialSuitability: 50,
  freshness: 70,
  expectedLifespan: 64,
  updatePotential: 55,
  competitionPenalty: 28,
  verificationDifficultyPenalty: 26,
  legalRiskPenalty: 18,
  copyrightRiskPenalty: 16,
  duplicateRiskPenalty: 22,
  sensationalismRiskPenalty: 12,
  sourceFamilies: 4,
  evolving: false,
  existingCoverage: false,
};

const opportunitySignals: readonly OpportunitySignal[] = [
  {
    ...opportunityDefaults,
    id: "opp-grid",
    topic: "Regional grid modernization plans",
    sourceStrength: 90,
    originalValueOpportunity: 87,
    readerUtility: 84,
    newsImportance: 82,
    sourceFamilies: 5,
  },
  {
    ...opportunityDefaults,
    id: "opp-transit",
    topic: "Transit reliability funding",
    searchMomentum: 96,
    unitedStatesRelevance: 94,
    newsImportance: 93,
    sourceStrength: 92,
    originalValueOpportunity: 91,
    visualPotential: 88,
    videoPotential: 72,
    readerUtility: 96,
    existingSiteAuthority: 89,
    freshness: 97,
    expectedLifespan: 86,
    updatePotential: 94,
    competitionPenalty: 8,
    verificationDifficultyPenalty: 12,
    legalRiskPenalty: 5,
    copyrightRiskPenalty: 4,
    duplicateRiskPenalty: 7,
    sensationalismRiskPenalty: 3,
    sourceFamilies: 6,
    evolving: true,
  },
  {
    ...opportunityDefaults,
    id: "opp-health",
    topic: "Primary care access proposal",
    sourceStrength: 61,
    readerUtility: 84,
    legalRiskPenalty: 38,
    sourceFamilies: 3,
  },
  {
    ...opportunityDefaults,
    id: "opp-rumor",
    topic: "Unverified emergency closure claim",
    searchMomentum: 91,
    sourceStrength: 18,
    legalRiskPenalty: 88,
    copyrightRiskPenalty: 78,
    sensationalismRiskPenalty: 92,
    sourceFamilies: 1,
    evolving: true,
  },
  {
    ...opportunityDefaults,
    id: "opp-housing",
    topic: "Housing permit reform",
    sourceStrength: 78,
    readerUtility: 74,
    updatePotential: 90,
    sourceFamilies: 4,
    existingCoverage: true,
  },
  {
    ...opportunityDefaults,
    id: "opp-small-business",
    topic: "Small-business lending guidance",
    sourceStrength: 49,
    readerUtility: 62,
    searchMomentum: 43,
    originalValueOpportunity: 54,
    sourceFamilies: 2,
  },
] as const;

const entities: readonly KnowledgeEntity[] = [
  {
    id: "entity-grid",
    label: "Regional power grid",
    type: "TOPIC",
    context: "Infrastructure used to move electricity across the demo region.",
  },
  {
    id: "entity-commission",
    label: "Regional utility commission",
    type: "ORGANIZATION",
    context: "Fictional oversight body in this product demonstration.",
  },
  {
    id: "entity-resilience-plan",
    label: "2026 resilience plan",
    type: "TOPIC",
    context: "Fictional policy record used to demonstrate entity linking.",
  },
  {
    id: "entity-metro",
    label: "Northline Metro",
    type: "LOCATION",
    context: "Fictional location used throughout the protected demo fixture.",
  },
  {
    id: "entity-hearing",
    label: "Public planning hearing",
    type: "EVENT",
    context: "Fictional event record with no claim about a real proceeding.",
  },
] as const;

const stories: readonly KnowledgeStory[] = [
  {
    id: "story-grid-plan",
    title: "Regional commission outlines a grid resilience plan",
    path: "/demo/grid-resilience-plan",
    entityIds: ["entity-grid", "entity-commission", "entity-resilience-plan"],
    publishedAtLabel: "Fictional demo · July 12",
  },
  {
    id: "story-hearing",
    title: "What to know before the public planning hearing",
    path: "/demo/planning-hearing-guide",
    entityIds: ["entity-commission", "entity-hearing", "entity-metro"],
    publishedAtLabel: "Fictional demo · July 16",
  },
  {
    id: "story-infrastructure",
    title: "How regional infrastructure proposals are reviewed",
    path: "/demo/infrastructure-review-explainer",
    entityIds: ["entity-grid", "entity-commission", "entity-metro"],
    publishedAtLabel: "Fictional demo · July 08",
  },
  {
    id: "story-resilience",
    title: "Timeline: the region's resilience planning process",
    path: "/demo/resilience-timeline",
    entityIds: ["entity-resilience-plan", "entity-hearing", "entity-metro"],
    publishedAtLabel: "Fictional demo · July 03",
  },
] as const;

function buildTrendSnapshots(): IntelligenceDemoViewModel["trendSnapshots"] {
  const countryEntries = intelligenceCountries.map(({ code }) => [
    code,
    Object.fromEntries(
      intelligenceWindows.map((window) => [
        window,
        buildTrendSnapshot(code, window),
      ]),
    ) as Record<IntelligenceWindow, TrendSnapshot>,
  ]);
  return Object.fromEntries(countryEntries) as Record<
    IntelligenceCountry,
    Record<IntelligenceWindow, TrendSnapshot>
  >;
}

export function buildIntelligenceDemoViewModel(): IntelligenceDemoViewModel {
  const linkSuggestions = suggestInternalLinks({
    sourceStory: stories[0],
    candidateStories: stories,
    entities,
    sourceWordCount: 900,
  });
  return {
    sampleLabel: "High-Signal Article Sample",
    sampleDisclosure:
      "120 fictional derived-metadata records for product evaluation. No article bodies, scraped paywalled text, live audience totals, or production rankings.",
    sample: buildHighSignalArticleSample(),
    trendSnapshots: buildTrendSnapshots(),
    publishers,
    connectors,
    opportunities: opportunitySignals.map(scoreOpportunity),
    formats: getFormatCatalog(),
    headlines: generateHeadlineCandidates({
      subject: "Regional utility commission",
      verifiedAction: "outlines a grid resilience proposal",
      readerImpact: "household reliability planning",
      location: "Northline Metro",
      timing: "July planning update",
    }),
    entities,
    stories,
    linkSuggestions,
  };
}
