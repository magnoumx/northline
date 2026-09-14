import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    role: text("role").notNull().default("Writer"),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_uq").on(table.email)],
);

export const sources = sqliteTable(
  "sources",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    publisher: text("publisher").notNull(),
    sourceType: text("source_type").notNull(),
    country: text("country").notNull().default("US"),
    ownership: text("ownership"),
    credibilityTier: integer("credibility_tier").notNull(),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    citationRequirements: text("citation_requirements"),
    licensingStatus: text("licensing_status").notNull().default("review_required"),
    reliabilityNotes: text("reliability_notes"),
    lastReviewedAt: integer("last_reviewed_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sources_domain_uq").on(table.domain),
    index("sources_tier_idx").on(table.credibilityTier),
  ],
);

export const storyClusters = sqliteTable(
  "story_clusters",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    status: text("status").notNull().default("developing"),
    plainSummary: text("plain_summary"),
    latestConfirmedDevelopment: text("latest_confirmed_development"),
    latestUpdateAt: integer("latest_update_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("story_clusters_slug_uq").on(table.slug),
    index("story_clusters_category_status_idx").on(table.category, table.status),
  ],
);

export const trends = sqliteTable(
  "trends",
  {
    id: text("id").primaryKey(),
    originalTerm: text("original_term").notNull(),
    normalizedTerm: text("normalized_term").notNull(),
    relatedTermsJson: text("related_terms_json").notNull().default("[]"),
    category: text("category").notNull(),
    entitiesJson: text("entities_json").notNull().default("[]"),
    geographicMarket: text("geographic_market").notNull().default("US"),
    firstDetectedAt: integer("first_detected_at", { mode: "timestamp_ms" }).notNull(),
    latestDetectedAt: integer("latest_detected_at", { mode: "timestamp_ms" }).notNull(),
    searchVelocity: integer("search_velocity").notNull().default(0),
    sourceVelocity: integer("source_velocity").notNull().default(0),
    socialVelocity: integer("social_velocity").notNull().default(0),
    usRelevance: integer("us_relevance").notNull().default(0),
    commercialValue: integer("commercial_value").notNull().default(0),
    novelty: integer("novelty").notNull().default(0),
    visualAvailability: integer("visual_availability").notNull().default(0),
    primarySourceAvailability: integer("primary_source_availability")
      .notNull()
      .default(0),
    riskLevel: text("risk_level").notNull().default("LOW"),
    score: integer("score").notNull().default(0),
    scoreExplanationJson: text("score_explanation_json").notNull().default("{}"),
    editorialState: text("editorial_state").notNull().default("SIGNAL_DETECTED"),
    storyClusterId: text("story_cluster_id").references(() => storyClusters.id),
    ...timestamps,
  },
  (table) => [
    index("trends_market_score_idx").on(table.geographicMarket, table.score),
    index("trends_normalized_term_idx").on(table.normalizedTerm),
    index("trends_state_idx").on(table.editorialState),
  ],
);

export const articles = sqliteTable(
  "articles",
  {
    id: text("id").primaryKey(),
    storyClusterId: text("story_cluster_id").references(() => storyClusters.id),
    slug: text("slug").notNull(),
    category: text("category").notNull(),
    format: text("format").notNull(),
    state: text("state").notNull().default("DRAFTING"),
    riskLevel: text("risk_level").notNull().default("LOW"),
    sensitive: integer("sensitive", { mode: "boolean" }).notNull().default(false),
    humanApprovalRequired: integer("human_approval_required", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    authorId: text("author_id").references(() => users.id),
    currentVersionId: text("current_version_id").references(
      (): AnySQLiteColumn => articleVersions.id,
      { onDelete: "restrict" },
    ),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("articles_slug_uq").on(table.slug),
    index("articles_state_published_idx").on(table.state, table.publishedAt),
    index("articles_cluster_idx").on(table.storyClusterId),
  ],
);

export const articleVersions = sqliteTable(
  "article_versions",
  {
    id: text("id").primaryKey(),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id),
    version: integer("version").notNull(),
    headline: text("headline").notNull(),
    subheadline: text("subheadline"),
    bodyJson: text("body_json").notNull(),
    keyTakeawaysJson: text("key_takeaways_json").notNull().default("[]"),
    seoJson: text("seo_json").notNull().default("{}"),
    structuredDataJson: text("structured_data_json").notNull().default("{}"),
    qualityScore: integer("quality_score").notNull().default(0),
    qualityExplanationJson: text("quality_explanation_json")
      .notNull()
      .default("{}"),
    changeSummary: text("change_summary").notNull(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    createdById: text("created_by_id").references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("article_versions_article_version_uq").on(
      table.articleId,
      table.version,
    ),
    index("article_versions_created_idx").on(table.articleId, table.createdAt),
  ],
);

export const claims = sqliteTable(
  "claims",
  {
    id: text("id").primaryKey(),
    articleVersionId: text("article_version_id")
      .notNull()
      .references(() => articleVersions.id),
    claimText: text("claim_text").notNull(),
    articleSection: text("article_section").notNull(),
    category: text("category").notNull(),
    importance: text("importance").notNull().default("supporting"),
    primaryEvidenceAvailable: integer("primary_evidence_available", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    verificationStatus: text("verification_status").notNull().default("UNVERIFIED"),
    riskLevel: text("risk_level").notNull().default("LOW"),
    reviewerId: text("reviewer_id").references(() => users.id),
    reviewNotes: text("review_notes"),
    verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("claims_version_status_idx").on(
      table.articleVersionId,
      table.verificationStatus,
    ),
    index("claims_importance_idx").on(table.importance),
  ],
);

export const evidence = sqliteTable(
  "evidence",
  {
    id: text("id").primaryKey(),
    claimId: text("claim_id")
      .notNull()
      .references(() => claims.id),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id),
    relationship: text("relationship").notNull(),
    sourceLocator: text("source_locator").notNull(),
    snapshotUrl: text("snapshot_url"),
    excerptHash: text("excerpt_hash"),
    observedAt: integer("observed_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("evidence_claim_idx").on(table.claimId),
    index("evidence_source_idx").on(table.sourceId),
  ],
);

export const stateTransitions = sqliteTable(
  "state_transitions",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    fromState: text("from_state"),
    toState: text("to_state").notNull(),
    actorId: text("actor_id"),
    reason: text("reason").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("state_transitions_entity_idx").on(
      table.entityType,
      table.entityId,
      table.occurredAt,
    ),
  ],
);

export const newsletterSubscribers = sqliteTable(
  "newsletter_subscribers",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    list: text("list").notNull(),
    status: text("status").notNull().default("pending"),
    consentSource: text("consent_source").notNull(),
    confirmationTokenHash: text("confirmation_token_hash").notNull(),
    confirmationTokenExpiresAt: integer("confirmation_token_expires_at", {
      mode: "timestamp_ms",
    }),
    consentedAt: integer("consented_at", { mode: "timestamp_ms" }).notNull(),
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
    unsubscribedAt: integer("unsubscribed_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("newsletter_email_list_uq").on(table.email, table.list),
    uniqueIndex("newsletter_confirmation_token_uq").on(
      table.confirmationTokenHash,
    ),
    index("newsletter_status_idx").on(table.status),
  ],
);

export const newsletterRateLimits = sqliteTable(
  "newsletter_rate_limits",
  {
    id: text("id").primaryKey(),
    scope: text("scope").notNull(),
    keyHash: text("key_hash").notNull(),
    windowStartedAt: integer("window_started_at", {
      mode: "timestamp_ms",
    }).notNull(),
    count: integer("count").notNull().default(1),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("newsletter_rate_limit_window_uq").on(
      table.scope,
      table.keyHash,
      table.windowStartedAt,
    ),
    index("newsletter_rate_limit_expiry_idx").on(table.expiresAt),
  ],
);

export const follows = sqliteTable(
  "follows",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.targetType, table.targetId],
    }),
    index("follows_target_idx").on(table.targetType, table.targetId),
  ],
);

export const savedArticles = sqliteTable(
  "saved_articles",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.articleId] }),
    index("saved_articles_article_idx").on(table.articleId),
  ],
);

export const connectors = sqliteTable(
  "connectors",
  {
    id: text("id").primaryKey(),
    sourceName: text("source_name").notNull(),
    connectorType: text("connector_type").notNull(),
    permittedUsage: text("permitted_usage").notNull(),
    rateLimitsJson: text("rate_limits_json").notNull().default("{}"),
    attributionRules: text("attribution_rules"),
    cachingRules: text("caching_rules"),
    supportedMarketsJson: text("supported_markets_json").notNull().default("[]"),
    supportedCategoriesJson: text("supported_categories_json")
      .notNull()
      .default("[]"),
    lastSuccessfulSyncAt: integer("last_successful_sync_at", {
      mode: "timestamp_ms",
    }),
    lastFailureAt: integer("last_failure_at", { mode: "timestamp_ms" }),
    failureCount: integer("failure_count").notNull().default(0),
    circuitBreakerStatus: text("circuit_breaker_status")
      .notNull()
      .default("CLOSED"),
    healthScore: integer("health_score").notNull().default(100),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("connectors_name_uq").on(table.sourceName),
    index("connectors_health_idx").on(table.healthScore),
  ],
);

export const jobRuns = sqliteTable(
  "job_runs",
  {
    id: text("id").primaryKey(),
    jobType: text("job_type").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    state: text("state").notNull(),
    attempt: integer("attempt").notNull().default(1),
    inputHash: text("input_hash").notNull(),
    outputJson: text("output_json"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    nextRetryAt: integer("next_retry_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("job_runs_idempotency_uq").on(table.idempotencyKey),
    index("job_runs_state_retry_idx").on(table.state, table.nextRetryAt),
  ],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    decision: text("decision").notNull(),
    reason: text("reason"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    ipHash: text("ip_hash"),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("audit_logs_target_idx").on(
      table.targetType,
      table.targetId,
      table.occurredAt,
    ),
    index("audit_logs_actor_idx").on(table.actorId, table.occurredAt),
  ],
);
