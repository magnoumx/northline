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
  users,
} from "./schema";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

export const contentSections = sqliteTable(
  "content_sections",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    navigationOrder: integer("navigation_order").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("content_sections_slug_uq").on(table.slug),
    index("content_sections_navigation_idx").on(
      table.active,
      table.navigationOrder,
    ),
  ],
);

export const contentTopics = sqliteTable(
  "content_topics",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("TOPIC"),
    description: text("description"),
    canonicalUrl: text("canonical_url"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("content_topics_kind_slug_uq").on(table.kind, table.slug),
    index("content_topics_active_kind_idx").on(table.active, table.kind),
    check(
      "content_topics_kind_ck",
      sql`${table.kind} IN ('TOPIC','PERSON','COMPANY','TEAM','PLACE','EVENT')`,
    ),
  ],
);

export const articleTopics = sqliteTable(
  "article_topics",
  {
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => contentTopics.id, { onDelete: "restrict" }),
    relationship: text("relationship").notNull().default("ABOUT"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    primaryKey({ columns: [table.articleId, table.topicId] }),
    index("article_topics_topic_idx").on(table.topicId, table.relationship),
  ],
);

export const articleAssignments = sqliteTable(
  "article_assignments",
  {
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    role: text("role").notNull(),
    assignedById: text("assigned_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    assignedAt: integer("assigned_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    primaryKey({ columns: [table.articleId, table.userId, table.role] }),
    index("article_assignments_user_role_idx").on(table.userId, table.role),
    check(
      "article_assignments_role_ck",
      sql`${table.role} IN ('WRITER','REVIEWER','EDITOR','MEDIA_REVIEWER','LEGAL_REVIEWER')`,
    ),
  ],
);

export const articleSourceLinks = sqliteTable(
  "article_source_links",
  {
    id: text("id").primaryKey(),
    articleVersionId: text("article_version_id")
      .notNull()
      .references(() => articleVersions.id, { onDelete: "restrict" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    relationship: text("relationship").notNull(),
    summary: text("summary").notNull(),
    /**
     * The exact page this version cites. The `sources` row identifies the
     * publisher; two articles from one publisher must not share a page
     * identity, so the document lives on the citation.
     */
    sourceUrl: text("source_url"),
    sourceTitle: text("source_title"),
    citationOrder: integer("citation_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("article_source_links_version_source_uq").on(
      table.articleVersionId,
      table.sourceId,
    ),
    index("article_source_links_version_order_idx").on(
      table.articleVersionId,
      table.citationOrder,
    ),
    check(
      "article_source_links_relationship_ck",
      sql`${table.relationship} IN ('PRIMARY','INDEPENDENT','CONTEXT','CONTRADICTS')`,
    ),
  ],
);

export const mediaAssets = sqliteTable(
  "media_assets",
  {
    id: text("id").primaryKey(),
    storageKey: text("storage_key").notNull(),
    publicUrl: text("public_url"),
    workflowState: text("workflow_state").notNull().default("UPLOADED"),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    frameCount: integer("frame_count"),
    checksumSha256: text("checksum_sha256").notNull(),
    creator: text("creator"),
    copyrightOwner: text("copyright_owner"),
    originalUrl: text("original_url"),
    license: text("license"),
    licenseUrl: text("license_url"),
    usagePermission: text("usage_permission"),
    attribution: text("attribution"),
    downloadedAt: integer("downloaded_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    verificationState: text("verification_state")
      .notNull()
      .default("UNVERIFIED"),
    malwareScanReference: text("malware_scan_reference"),
    metadataStrippedAt: integer("metadata_stripped_at", {
      mode: "timestamp_ms",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("media_assets_storage_key_uq").on(table.storageKey),
    uniqueIndex("media_assets_checksum_uq").on(table.checksumSha256),
    index("media_assets_workflow_idx").on(
      table.workflowState,
      table.verificationState,
    ),
    check("media_assets_byte_size_ck", sql`${table.byteSize} > 0`),
    check(
      "media_assets_workflow_ck",
      sql`${table.workflowState} IN ('UPLOADED','QUARANTINED','VALIDATING','SCANNING','RIGHTS_REVIEW','APPROVED','REJECTED','EXPIRED')`,
    ),
  ],
);

export const articleMedia = sqliteTable(
  "article_media",
  {
    articleVersionId: text("article_version_id")
      .notNull()
      .references(() => articleVersions.id, { onDelete: "restrict" }),
    mediaAssetId: text("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
    role: text("role").notNull(),
    position: integer("position").notNull().default(0),
    altText: text("alt_text").notNull(),
    caption: text("caption"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    primaryKey({
      columns: [table.articleVersionId, table.mediaAssetId, table.role],
    }),
    index("article_media_version_position_idx").on(
      table.articleVersionId,
      table.position,
    ),
    check(
      "article_media_role_ck",
      sql`${table.role} IN ('HERO','INLINE','SOCIAL','VIDEO','THUMBNAIL')`,
    ),
  ],
);

export const corrections = sqliteTable(
  "corrections",
  {
    id: text("id").primaryKey(),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "restrict" }),
    fromVersionId: text("from_version_id")
      .notNull()
      .references(() => articleVersions.id, { onDelete: "restrict" }),
    correctedVersionId: text("corrected_version_id")
      .notNull()
      .references(() => articleVersions.id, { onDelete: "restrict" }),
    summary: text("summary").notNull(),
    severity: text("severity").notNull().default("STANDARD"),
    visible: integer("visible", { mode: "boolean" }).notNull().default(true),
    approvedById: text("approved_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("corrections_corrected_version_uq").on(
      table.correctedVersionId,
    ),
    index("corrections_article_published_idx").on(
      table.articleId,
      table.publishedAt,
    ),
  ],
);

export const storyUpdates = sqliteTable(
  "story_updates",
  {
    id: text("id").primaryKey(),
    storyClusterId: text("story_cluster_id")
      .notNull()
      .references(() => storyClusters.id, { onDelete: "cascade" }),
    articleVersionId: text("article_version_id").references(
      () => articleVersions.id,
      { onDelete: "restrict" },
    ),
    headline: text("headline").notNull(),
    body: text("body").notNull(),
    verificationState: text("verification_state").notNull(),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("story_updates_cluster_published_idx").on(
      table.storyClusterId,
      table.publishedAt,
    ),
  ],
);

export const contentRedirects = sqliteTable(
  "content_redirects",
  {
    id: text("id").primaryKey(),
    sourcePath: text("source_path").notNull(),
    destinationPath: text("destination_path").notNull(),
    statusCode: integer("status_code").notNull().default(301),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    reason: text("reason").notNull(),
    createdById: text("created_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("content_redirects_source_uq").on(table.sourcePath),
    check(
      "content_redirects_status_ck",
      sql`${table.statusCode} IN (301,302,307,308,410)`,
    ),
  ],
);

export const seoBriefs = sqliteTable(
  "seo_briefs",
  {
    id: text("id").primaryKey(),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    primaryReaderIntent: text("primary_reader_intent").notNull(),
    primaryQuery: text("primary_query"),
    secondaryQueriesJson: text("secondary_queries_json").notNull().default("[]"),
    entitiesJson: text("entities_json").notNull().default("[]"),
    questionsJson: text("questions_json").notNull().default("[]"),
    competingCoverageJson: text("competing_coverage_json")
      .notNull()
      .default("[]"),
    missingReaderValue: text("missing_reader_value").notNull(),
    recommendedFormat: text("recommended_format").notNull(),
    headlineDirection: text("headline_direction").notNull(),
    internalLinksJson: text("internal_links_json").notNull().default("[]"),
    mediaJson: text("media_json").notNull().default("[]"),
    freshnessPlan: text("freshness_plan").notNull(),
    updateTriggersJson: text("update_triggers_json").notNull().default("[]"),
    demandEstimate: text("demand_estimate").notNull().default("UNKNOWN"),
    approvedById: text("approved_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("seo_briefs_article_uq").on(table.articleId),
    check(
      "seo_briefs_demand_ck",
      sql`${table.demandEstimate} IN ('UNKNOWN','LOW','MEDIUM','HIGH')`,
    ),
  ],
);

export const researchDossiers = sqliteTable(
  "research_dossiers",
  {
    id: text("id").primaryKey(),
    storyClusterId: text("story_cluster_id")
      .notNull()
      .references(() => storyClusters.id, { onDelete: "cascade" }),
    state: text("state").notNull().default("RESEARCHING"),
    approvedOutlineJson: text("approved_outline_json"),
    verifiedClaimsJson: text("verified_claims_json").notNull().default("[]"),
    attributedQuotesJson: text("attributed_quotes_json")
      .notNull()
      .default("[]"),
    sourceSummariesJson: text("source_summaries_json")
      .notNull()
      .default("[]"),
    explicitUnknownsJson: text("explicit_unknowns_json")
      .notNull()
      .default("[]"),
    inputHash: text("input_hash").notNull(),
    approvedById: text("approved_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("research_dossiers_cluster_hash_uq").on(
      table.storyClusterId,
      table.inputHash,
    ),
    index("research_dossiers_state_idx").on(table.state, table.updatedAt),
  ],
);

export const sourceSnapshots = sqliteTable(
  "source_snapshots",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    dossierId: text("dossier_id").references(() => researchDossiers.id, {
      onDelete: "set null",
    }),
    originalUrl: text("original_url").notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    storageKey: text("storage_key"),
    contentHash: text("content_hash").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    permissionBasis: text("permission_basis").notNull(),
    sanitizedText: text("sanitized_text"),
    untrustedData: integer("untrusted_data", { mode: "boolean" })
      .notNull()
      .default(true),
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("source_snapshots_source_hash_uq").on(
      table.sourceId,
      table.contentHash,
    ),
    index("source_snapshots_dossier_idx").on(table.dossierId, table.fetchedAt),
    check("source_snapshots_size_ck", sql`${table.byteSize} > 0`),
  ],
);
