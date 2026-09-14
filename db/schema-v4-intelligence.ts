import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
  articles,
  articleVersions,
  sources,
  storyClusters,
  trends,
} from "./schema";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

export const contentIntelligenceSamples = sqliteTable(
  "content_intelligence_samples",
  {
    id: text("id").primaryKey(),
    monthUtc: text("month_utc").notNull(),
    label: text("label").notNull().default("High-Signal Article Sample"),
    articleCount: integer("article_count").notNull(),
    market: text("market").notNull().default("US"),
    methodologyJson: text("methodology_json").notNull(),
    sourceMixJson: text("source_mix_json").notNull().default("[]"),
    metricDefinitionsJson: text("metric_definitions_json").notNull(),
    provenanceJson: text("provenance_json").notNull(),
    state: text("state").notNull().default("DRAFT"),
    sampledAt: integer("sampled_at", { mode: "timestamp_ms" }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("content_intelligence_samples_month_market_uq").on(
      table.monthUtc,
      table.market,
    ),
    check(
      "content_intelligence_samples_count_ck",
      sql`${table.articleCount} >= 100`,
    ),
    check(
      "content_intelligence_samples_state_ck",
      sql`${table.state} IN ('DRAFT','READY','STALE','REJECTED')`,
    ),
  ],
);

export const publisherIntelligence = sqliteTable(
  "publisher_intelligence",
  {
    id: text("id").primaryKey(),
    sampleId: text("sample_id")
      .notNull()
      .references(() => contentIntelligenceSamples.id, {
        onDelete: "cascade",
      }),
    sourceId: text("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    publisherLabel: text("publisher_label").notNull(),
    articleCount: integer("article_count").notNull(),
    derivedMetricsJson: text("derived_metrics_json").notNull(),
    caveatsJson: text("caveats_json").notNull().default("[]"),
    observedAt: integer("observed_at", { mode: "timestamp_ms" }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("publisher_intelligence_sample_publisher_uq").on(
      table.sampleId,
      table.publisherLabel,
    ),
    index("publisher_intelligence_source_idx").on(
      table.sourceId,
      table.observedAt,
    ),
    check(
      "publisher_intelligence_article_count_ck",
      sql`${table.articleCount} >= 0`,
    ),
  ],
);

export const contentIntelligenceArticles = sqliteTable(
  "content_intelligence_articles",
  {
    id: text("id").primaryKey(),
    sampleId: text("sample_id")
      .notNull()
      .references(() => contentIntelligenceSamples.id, {
        onDelete: "cascade",
      }),
    sourceId: text("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    canonicalUrl: text("canonical_url").notNull(),
    publisherLabel: text("publisher_label").notNull(),
    country: text("country").notNull(),
    language: text("language").notNull(),
    category: text("category").notNull(),
    headline: text("headline").notNull(),
    deck: text("deck"),
    authorLabel: text("author_label"),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    lastUpdatedAt: integer("last_updated_at", { mode: "timestamp_ms" }),
    detectedTrend: text("detected_trend"),
    searchIntent: text("search_intent"),
    demandClass: text("demand_class"),
    publicRankingPosition: integer("public_ranking_position"),
    wordCount: integer("word_count").notNull().default(0),
    readingTimeMinutes: integer("reading_time_minutes").notNull().default(0),
    openingStyle: text("opening_style"),
    headlinePattern: text("headline_pattern"),
    sectionCount: integer("section_count").notNull().default(0),
    paragraphCount: integer("paragraph_count").notNull().default(0),
    imageCount: integer("image_count").notNull().default(0),
    videoCount: integer("video_count").notNull().default(0),
    chartCount: integer("chart_count").notNull().default(0),
    tableCount: integer("table_count").notNull().default(0),
    hasFaq: integer("has_faq", { mode: "boolean" }).notNull().default(false),
    hasTimeline: integer("has_timeline", { mode: "boolean" })
      .notNull()
      .default(false),
    sourceVisibility: text("source_visibility"),
    internalLinkCount: integer("internal_link_count").notNull().default(0),
    externalSourceCount: integer("external_source_count").notNull().default(0),
    structuredDataTypesJson: text("structured_data_types_json")
      .notNull()
      .default("[]"),
    newsletterCtaPosition: text("newsletter_cta_position"),
    advertisementDensity: text("advertisement_density"),
    updateFrequency: text("update_frequency"),
    articleFormat: text("article_format"),
    freshnessModel: text("freshness_model"),
    publicSignalsJson: text("public_signals_json").notNull().default("[]"),
    metricLimitationsJson: text("metric_limitations_json")
      .notNull()
      .default("[]"),
    metadataOnly: integer("metadata_only", { mode: "boolean" })
      .notNull()
      .default(true),
    observedAt: integer("observed_at", { mode: "timestamp_ms" }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("content_intelligence_articles_sample_url_uq").on(
      table.sampleId,
      table.canonicalUrl,
    ),
    index("content_intelligence_articles_publisher_idx").on(
      table.publisherLabel,
      table.observedAt,
    ),
    check(
      "content_intelligence_articles_counts_ck",
      sql`${table.wordCount} >= 0 AND ${table.readingTimeMinutes} >= 0 AND ${table.sectionCount} >= 0 AND ${table.paragraphCount} >= 0 AND ${table.imageCount} >= 0 AND ${table.videoCount} >= 0 AND ${table.chartCount} >= 0 AND ${table.tableCount} >= 0 AND ${table.internalLinkCount} >= 0 AND ${table.externalSourceCount} >= 0`,
    ),
    check(
      "content_intelligence_articles_metadata_only_ck",
      sql`${table.metadataOnly} = 1`,
    ),
  ],
);

export const trendSignalObservations = sqliteTable(
  "trend_signal_observations",
  {
    id: text("id").primaryKey(),
    normalizedTopic: text("normalized_topic").notNull(),
    originalQuery: text("original_query").notNull(),
    country: text("country").notNull(),
    region: text("region"),
    language: text("language").notNull(),
    category: text("category").notNull(),
    window: text("window").notNull(),
    metricType: text("metric_type").notNull(),
    relativeSearchInterest: integer("relative_search_interest"),
    estimatedMonthlySearches: integer("estimated_monthly_searches"),
    ownSiteImpressions: integer("own_site_impressions"),
    ownSiteClicks: integer("own_site_clicks"),
    publicSocialSignal: integer("public_social_signal"),
    estimatedTraffic: integer("estimated_traffic"),
    searchGrowthBps: integer("search_growth_bps"),
    newsSourceVelocity: integer("news_source_velocity"),
    videoVelocity: integer("video_velocity"),
    wikipediaInterest: integer("wikipedia_interest"),
    metricSource: text("metric_source").notNull(),
    metricConfidence: text("metric_confidence").notNull(),
    provenanceJson: text("provenance_json").notNull(),
    firstDetectedAt: integer("first_detected_at", {
      mode: "timestamp_ms",
    }).notNull(),
    lastDetectedAt: integer("last_detected_at", {
      mode: "timestamp_ms",
    }).notNull(),
    peakAt: integer("peak_at", { mode: "timestamp_ms" }),
    observedAt: integer("observed_at", { mode: "timestamp_ms" }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("trend_signal_observations_dedupe_uq").on(
      table.normalizedTopic,
      table.originalQuery,
      table.country,
      table.region,
      table.window,
      table.metricSource,
      table.observedAt,
    ),
    index("trend_signal_observations_market_idx").on(
      table.country,
      table.window,
      table.observedAt,
    ),
    check(
      "trend_signal_observations_window_ck",
      sql`${table.window} IN ('4h','12h','24h','7d','30d','12mo','custom')`,
    ),
    check(
      "trend_signal_observations_metric_ck",
      sql`${table.metricType} IN ('RELATIVE_SEARCH_INTEREST','ESTIMATED_MONTHLY_SEARCHES','OWN_SITE_IMPRESSIONS','OWN_SITE_CLICKS','PUBLIC_SOCIAL_SIGNALS','ESTIMATED_TRAFFIC')`,
    ),
    check(
      "trend_signal_observations_relative_ck",
      sql`${table.relativeSearchInterest} IS NULL OR (${table.relativeSearchInterest} >= 0 AND ${table.relativeSearchInterest} <= 100)`,
    ),
  ],
);

export const storyOpportunities = sqliteTable(
  "story_opportunities",
  {
    id: text("id").primaryKey(),
    trendId: text("trend_id").references(() => trends.id, {
      onDelete: "set null",
    }),
    storyClusterId: text("story_cluster_id").references(
      () => storyClusters.id,
      { onDelete: "set null" },
    ),
    state: text("state").notNull().default("WATCH"),
    recommendedFormat: text("recommended_format").notNull(),
    reasonCodesJson: text("reason_codes_json").notNull().default("[]"),
    explanation: text("explanation").notNull(),
    internalScoresJson: text("internal_scores_json").notNull(),
    evidenceIdsJson: text("evidence_ids_json").notNull().default("[]"),
    market: text("market").notNull().default("US"),
    window: text("window").notNull().default("24h"),
    decidedBy: text("decided_by"),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    index("story_opportunities_state_updated_idx").on(
      table.state,
      table.updatedAt,
    ),
    index("story_opportunities_trend_idx").on(table.trendId),
    check(
      "story_opportunities_state_ck",
      sql`${table.state} IN ('REJECT','WATCH','RESEARCH','QUICK_BRIEF','STANDARD_STORY','DEEP_EXPLAINER','LIVE_COVERAGE','VISUAL_STORY','VIDEO_STORY','UPDATE_EXISTING_STORY')`,
    ),
    check(
      "story_opportunities_format_ck",
      sql`${table.recommendedFormat} IN ('NEWS_FLASH','QUICK_BRIEF','STANDARD_STORY','DEEP_EXPLAINER','ULTIMATE_GUIDE','LIVE_COVERAGE')`,
    ),
  ],
);

export const articlePresentationProfiles = sqliteTable(
  "article_presentation_profiles",
  {
    articleVersionId: text("article_version_id")
      .primaryKey()
      .references(() => articleVersions.id, { onDelete: "cascade" }),
    depthFormat: text("depth_format").notNull(),
    availableModesJson: text("available_modes_json").notNull(),
    quickTakeJson: text("quick_take_json"),
    timelineJson: text("timeline_json"),
    sourcePanelJson: text("source_panel_json").notNull().default("{}"),
    generatedFromContentHash: text("generated_from_content_hash").notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "article_presentation_profiles_format_ck",
      sql`${table.depthFormat} IN ('NEWS_FLASH','QUICK_BRIEF','STANDARD_STORY','DEEP_EXPLAINER','ULTIMATE_GUIDE','LIVE_COVERAGE')`,
    ),
  ],
);

export const headlineLabs = sqliteTable(
  "headline_labs",
  {
    id: text("id").primaryKey(),
    articleVersionId: text("article_version_id")
      .notNull()
      .references(() => articleVersions.id, { onDelete: "cascade" }),
    state: text("state").notNull().default("GENERATING"),
    candidateCount: integer("candidate_count").notNull().default(0),
    rubricVersion: text("rubric_version").notNull(),
    evidencePacketHash: text("evidence_packet_hash").notNull(),
    approvedCandidateId: text("approved_candidate_id"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("headline_labs_version_rubric_uq").on(
      table.articleVersionId,
      table.rubricVersion,
    ),
    check(
      "headline_labs_state_ck",
      sql`${table.state} IN ('GENERATING','READY','HUMAN_REVIEW','APPROVED','REJECTED','EXPIRED')`,
    ),
    check(
      "headline_labs_candidate_count_ck",
      sql`${table.candidateCount} >= 0`,
    ),
    check(
      "headline_labs_ready_count_ck",
      sql`${table.state} NOT IN ('READY','HUMAN_REVIEW','APPROVED') OR ${table.candidateCount} >= 20`,
    ),
  ],
);

export const headlineCandidates = sqliteTable(
  "headline_candidates",
  {
    id: text("id").primaryKey(),
    labId: text("lab_id")
      .notNull()
      .references(() => headlineLabs.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    category: text("category").notNull(),
    headline: text("headline").notNull(),
    scoresJson: text("scores_json").notNull(),
    hardRejectReason: text("hard_reject_reason"),
    eligibleForExperiment: integer("eligible_for_experiment", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    experimentAllocationBps: integer("experiment_allocation_bps")
      .notNull()
      .default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("headline_candidates_lab_ordinal_uq").on(
      table.labId,
      table.ordinal,
    ),
    check(
      "headline_candidates_ordinal_ck",
      sql`${table.ordinal} >= 1`,
    ),
    check(
      "headline_candidates_allocation_ck",
      sql`${table.experimentAllocationBps} >= 0 AND ${table.experimentAllocationBps} <= 10000`,
    ),
  ],
);

export const contentEntities = sqliteTable(
  "content_entities",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    canonicalName: text("canonical_name").notNull(),
    slug: text("slug").notNull(),
    aliasesJson: text("aliases_json").notNull().default("[]"),
    description: text("description").notNull(),
    disambiguationJson: text("disambiguation_json").notNull().default("{}"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("content_entities_type_slug_uq").on(table.type, table.slug),
    index("content_entities_name_idx").on(table.canonicalName),
    check(
      "content_entities_type_ck",
      sql`${table.type} IN ('PERSON','ORGANIZATION','COMPANY','PRODUCT','GOVERNMENT_AGENCY','LOCATION','SPORTS_TEAM','LEAGUE','EVENT','MOVIE','TV_SHOW','GAME','TECHNOLOGY','TOPIC')`,
    ),
  ],
);

export const articleEntityMentions = sqliteTable(
  "article_entity_mentions",
  {
    articleVersionId: text("article_version_id")
      .notNull()
      .references(() => articleVersions.id, { onDelete: "cascade" }),
    entityId: text("entity_id")
      .notNull()
      .references(() => contentEntities.id, { onDelete: "cascade" }),
    mentionOrdinal: integer("mention_ordinal").notNull(),
    textOffset: integer("text_offset").notNull(),
    mentionText: text("mention_text").notNull(),
    contextDigest: text("context_digest").notNull(),
    confidenceBps: integer("confidence_bps").notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [
        table.articleVersionId,
        table.entityId,
        table.mentionOrdinal,
      ],
    }),
    index("article_entity_mentions_first_idx").on(
      table.articleVersionId,
      table.textOffset,
    ),
    check(
      "article_entity_mentions_confidence_ck",
      sql`${table.confidenceBps} >= 0 AND ${table.confidenceBps} <= 10000`,
    ),
  ],
);

export const internalLinkSuggestions = sqliteTable(
  "internal_link_suggestions",
  {
    id: text("id").primaryKey(),
    sourceArticleVersionId: text("source_article_version_id")
      .notNull()
      .references(() => articleVersions.id, { onDelete: "cascade" }),
    targetArticleId: text("target_article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    entityId: text("entity_id").references(() => contentEntities.id, {
      onDelete: "set null",
    }),
    anchorText: text("anchor_text").notNull(),
    sourceTextOffset: integer("source_text_offset").notNull(),
    reason: text("reason").notNull(),
    qualityScoreBps: integer("quality_score_bps").notNull(),
    state: text("state").notNull().default("SUGGESTED"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("internal_link_suggestions_source_target_anchor_uq").on(
      table.sourceArticleVersionId,
      table.targetArticleId,
      table.sourceTextOffset,
    ),
    index("internal_link_suggestions_review_idx").on(
      table.state,
      table.createdAt,
    ),
    check(
      "internal_link_suggestions_state_ck",
      sql`${table.state} IN ('SUGGESTED','APPROVED','REJECTED','STALE','PUBLISHED')`,
    ),
    check(
      "internal_link_suggestions_quality_ck",
      sql`${table.qualityScoreBps} >= 0 AND ${table.qualityScoreBps} <= 10000`,
    ),
  ],
);

export const authenticatedReaderProgress = sqliteTable(
  "authenticated_reader_progress",
  {
    readerSubjectHash: text("reader_subject_hash").notNull(),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    articleVersionId: text("article_version_id")
      .notNull()
      .references(() => articleVersions.id, { onDelete: "cascade" }),
    readingProgressBps: integer("reading_progress_bps").notNull().default(0),
    audioPositionMs: integer("audio_position_ms").notNull().default(0),
    lastMode: text("last_mode").notNull().default("FULL_STORY"),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.readerSubjectHash, table.articleId],
    }),
    index("authenticated_reader_progress_recent_idx").on(
      table.readerSubjectHash,
      table.lastSeenAt,
    ),
    check(
      "authenticated_reader_progress_bps_ck",
      sql`${table.readingProgressBps} >= 0 AND ${table.readingProgressBps} <= 10000`,
    ),
    check(
      "authenticated_reader_progress_audio_ck",
      sql`${table.audioPositionMs} >= 0`,
    ),
    check(
      "authenticated_reader_progress_mode_ck",
      sql`${table.lastMode} IN ('QUICK_TAKE','FULL_STORY','TIMELINE','SOURCES','LISTEN')`,
    ),
  ],
);
