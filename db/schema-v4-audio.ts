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
import { articles, articleVersions, users } from "./schema";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

export const articleAudioVersions = sqliteTable(
  "article_audio_versions",
  {
    id: text("id").primaryKey(),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "restrict" }),
    articleVersionId: text("article_version_id")
      .notNull()
      .references(() => articleVersions.id, { onDelete: "restrict" }),
    variant: text("variant").notNull(),
    state: text("state").notNull().default("NOT_REQUESTED"),
    inputHash: text("input_hash").notNull(),
    narrationPolicyVersion: text("narration_policy_version").notNull(),
    provider: text("provider"),
    modelId: text("model_id"),
    voiceId: text("voice_id"),
    outputFormat: text("output_format"),
    contentType: text("content_type"),
    characterCount: integer("character_count").notNull().default(0),
    chunkCount: integer("chunk_count").notNull().default(0),
    estimatedCostMicros: integer("estimated_cost_micros")
      .notNull()
      .default(0),
    actualCostMicros: integer("actual_cost_micros"),
    durationMs: integer("duration_ms"),
    storageBucket: text("storage_bucket"),
    storageKey: text("storage_key"),
    storageEtag: text("storage_etag"),
    storageChecksum: text("storage_checksum"),
    storageByteLength: integer("storage_byte_length"),
    chapterTimingsJson: text("chapter_timings_json").notNull().default("[]"),
    speechTimingsJson: text("speech_timings_json").notNull().default("[]"),
    disclosure: text("disclosure")
      .notNull()
      .default("AI-generated narration"),
    downloadAllowed: integer("download_allowed", { mode: "boolean" })
      .notNull()
      .default(false),
    generationAttempt: integer("generation_attempt").notNull().default(0),
    queueJobId: text("queue_job_id"),
    requestedById: text("requested_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    failureCode: text("failure_code"),
    failureDigest: text("failure_digest"),
    requestedAt: integer("requested_at", { mode: "timestamp_ms" }),
    generationStartedAt: integer("generation_started_at", {
      mode: "timestamp_ms",
    }),
    processingStartedAt: integer("processing_started_at", {
      mode: "timestamp_ms",
    }),
    readyAt: integer("ready_at", { mode: "timestamp_ms" }),
    failedAt: integer("failed_at", { mode: "timestamp_ms" }),
    staleAt: integer("stale_at", { mode: "timestamp_ms" }),
    rejectedAt: integer("rejected_at", { mode: "timestamp_ms" }),
    cooldownUntil: integer("cooldown_until", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("article_audio_version_variant_uq").on(
      table.articleVersionId,
      table.variant,
    ),
    uniqueIndex("article_audio_storage_key_uq").on(table.storageKey),
    index("article_audio_article_state_idx").on(
      table.articleId,
      table.state,
      table.updatedAt,
    ),
    index("article_audio_queue_state_idx").on(
      table.state,
      table.requestedAt,
    ),
    check(
      "article_audio_variant_ck",
      sql`${table.variant} IN ('FULL_ARTICLE','QUICK_BRIEF')`,
    ),
    check(
      "article_audio_state_ck",
      sql`${table.state} IN ('NOT_REQUESTED','QUEUED','GENERATING','PROCESSING','READY','FAILED','STALE','REJECTED')`,
    ),
    check(
      "article_audio_provider_ck",
      sql`${table.provider} IS NULL OR ${table.provider} IN ('OPENAI_TTS','GOOGLE_CLOUD_TTS','ELEVENLABS')`,
    ),
    check(
      "article_audio_cost_ck",
      sql`${table.estimatedCostMicros} >= 0 AND (${table.actualCostMicros} IS NULL OR ${table.actualCostMicros} >= 0)`,
    ),
    check(
      "article_audio_size_ck",
      sql`${table.characterCount} >= 0 AND ${table.chunkCount} >= 0 AND ${table.generationAttempt} >= 0`,
    ),
    check(
      "article_audio_ready_ck",
      sql`${table.state} <> 'READY' OR (${table.provider} IS NOT NULL AND ${table.modelId} IS NOT NULL AND ${table.voiceId} IS NOT NULL AND ${table.contentType} LIKE 'audio/%' AND ${table.durationMs} > 0 AND ${table.storageBucket} IS NOT NULL AND ${table.storageKey} IS NOT NULL AND ${table.storageChecksum} IS NOT NULL AND ${table.storageByteLength} > 0 AND ${table.readyAt} IS NOT NULL)`,
    ),
  ],
);

export const articleAudioChunks = sqliteTable(
  "article_audio_chunks",
  {
    id: text("id").primaryKey(),
    articleAudioVersionId: text("article_audio_version_id")
      .notNull()
      .references(() => articleAudioVersions.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    chapterIndex: integer("chapter_index").notNull(),
    textHash: text("text_hash").notNull(),
    characterCount: integer("character_count").notNull(),
    state: text("state").notNull().default("QUEUED"),
    provider: text("provider").notNull(),
    providerRequestIdHash: text("provider_request_id_hash"),
    contentType: text("content_type"),
    temporaryStorageKey: text("temporary_storage_key"),
    durationMs: integer("duration_ms"),
    costMicros: integer("cost_micros").notNull().default(0),
    generationAttempt: integer("generation_attempt").notNull(),
    timingJson: text("timing_json").notNull().default("[]"),
    failureCode: text("failure_code"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("article_audio_chunks_ordinal_uq").on(
      table.articleAudioVersionId,
      table.ordinal,
    ),
    index("article_audio_chunks_state_idx").on(
      table.articleAudioVersionId,
      table.state,
    ),
    check(
      "article_audio_chunk_state_ck",
      sql`${table.state} IN ('QUEUED','GENERATING','READY','FAILED')`,
    ),
    check(
      "article_audio_chunk_bounds_ck",
      sql`${table.ordinal} >= 0 AND ${table.chapterIndex} >= 0 AND ${table.characterCount} > 0 AND ${table.costMicros} >= 0 AND ${table.generationAttempt} >= 1`,
    ),
    check(
      "article_audio_chunk_ready_ck",
      sql`${table.state} <> 'READY' OR (${table.contentType} LIKE 'audio/%' AND ${table.temporaryStorageKey} IS NOT NULL AND ${table.durationMs} > 0)`,
    ),
  ],
);

export const articleAudioCostLedger = sqliteTable(
  "article_audio_cost_ledger",
  {
    id: text("id").primaryKey(),
    articleAudioVersionId: text("article_audio_version_id")
      .notNull()
      .references(() => articleAudioVersions.id, { onDelete: "restrict" }),
    articleVersionId: text("article_version_id")
      .notNull()
      .references(() => articleVersions.id, { onDelete: "restrict" }),
    provider: text("provider").notNull(),
    entryType: text("entry_type").notNull(),
    amountMicros: integer("amount_micros").notNull(),
    budgetDate: text("budget_date").notNull(),
    idempotencyKeyHash: text("idempotency_key_hash").notNull(),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("article_audio_cost_idempotency_uq").on(
      table.idempotencyKeyHash,
    ),
    index("article_audio_cost_budget_idx").on(
      table.budgetDate,
      table.entryType,
      table.recordedAt,
    ),
    index("article_audio_cost_version_idx").on(
      table.articleAudioVersionId,
      table.recordedAt,
    ),
    check(
      "article_audio_cost_entry_type_ck",
      sql`${table.entryType} IN ('RESERVATION','ACTUAL','RELEASE')`,
    ),
    check(
      "article_audio_cost_amount_ck",
      sql`${table.amountMicros} >= 0`,
    ),
  ],
);

export const articleAudioProgress = sqliteTable(
  "article_audio_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    articleAudioVersionId: text("article_audio_version_id")
      .notNull()
      .references(() => articleAudioVersions.id, { onDelete: "cascade" }),
    positionMs: integer("position_ms").notNull().default(0),
    durationMs: integer("duration_ms").notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.articleAudioVersionId] }),
    index("article_audio_progress_user_idx").on(
      table.userId,
      table.updatedAt,
    ),
    check(
      "article_audio_progress_bounds_ck",
      sql`${table.positionMs} >= 0 AND ${table.durationMs} > 0 AND ${table.positionMs} <= ${table.durationMs}`,
    ),
  ],
);
