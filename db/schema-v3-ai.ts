import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { storyClusters, trends } from "./schema";
import { researchDossiers } from "./schema-v3-content";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

export const connectorRuns = sqliteTable(
  "connector_runs",
  {
    id: text("id").primaryKey(),
    connectorId: text("connector_id").notNull(),
    provider: text("provider").notNull(),
    state: text("state").notNull(),
    credentialsState: text("credentials_state").notNull(),
    termsNotes: text("terms_notes").notNull(),
    rateLimitJson: text("rate_limit_json").notNull().default("{}"),
    marketsJson: text("markets_json").notNull().default("[]"),
    categoriesJson: text("categories_json").notNull().default("[]"),
    costMicros: integer("cost_micros").notNull().default(0),
    itemCount: integer("item_count").notNull().default(0),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    errorCategory: text("error_category"),
    errorDigest: text("error_digest"),
    circuitState: text("circuit_state").notNull().default("CLOSED"),
    failureCount: integer("failure_count").notNull().default(0),
  },
  (table) => [
    uniqueIndex("connector_runs_connector_started_uq").on(
      table.connectorId,
      table.startedAt,
    ),
    index("connector_runs_state_started_idx").on(table.state, table.startedAt),
    check("connector_runs_cost_ck", sql`${table.costMicros} >= 0`),
  ],
);

export const trendSignals = sqliteTable(
  "trend_signals",
  {
    id: text("id").primaryKey(),
    connectorRunId: text("connector_run_id")
      .notNull()
      .references(() => connectorRuns.id, { onDelete: "cascade" }),
    externalIdHash: text("external_id_hash").notNull(),
    title: text("title").notNull(),
    normalizedTitle: text("normalized_title").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourcePublishedAt: integer("source_published_at", {
      mode: "timestamp_ms",
    }),
    market: text("market").notNull().default("US"),
    category: text("category"),
    signalValue: integer("signal_value").notNull().default(0),
    attribution: text("attribution"),
    trendId: text("trend_id").references(() => trends.id, {
      onDelete: "set null",
    }),
    detectedAt: integer("detected_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("trend_signals_connector_external_uq").on(
      table.connectorRunId,
      table.externalIdHash,
    ),
    index("trend_signals_market_detected_idx").on(
      table.market,
      table.detectedAt,
    ),
  ],
);

export const aiPromptVersions = sqliteTable(
  "ai_prompt_versions",
  {
    id: text("id").primaryKey(),
    taskKind: text("task_kind").notNull(),
    version: text("version").notNull(),
    policyVersion: text("policy_version").notNull(),
    templateHash: text("template_hash").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(false),
    approvedBy: text("approved_by"),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("ai_prompt_versions_kind_version_uq").on(
      table.taskKind,
      table.version,
    ),
    index("ai_prompt_versions_active_idx").on(table.taskKind, table.active),
  ],
);

export const aiTasks = sqliteTable(
  "ai_tasks",
  {
    id: text("id").primaryKey(),
    taskKind: text("task_kind").notNull(),
    storyId: text("story_id").references(() => storyClusters.id, {
      onDelete: "set null",
    }),
    dossierId: text("dossier_id").references(() => researchDossiers.id, {
      onDelete: "set null",
    }),
    inputContentHash: text("input_content_hash").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    policyVersion: text("policy_version").notNull(),
    dataClass: text("data_class").notNull().default("PUBLIC"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    estimatedCostMicros: integer("estimated_cost_micros").notNull().default(0),
    retryCount: integer("retry_count").notNull().default(0),
    structuredOutputValid: integer("structured_output_valid", {
      mode: "boolean",
    }),
    evidenceIdsJson: text("evidence_ids_json").notNull().default("[]"),
    resultDisposition: text("result_disposition").notNull(),
    errorCategory: text("error_category"),
    outputJson: text("output_json"),
    requestId: text("request_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("ai_tasks_story_kind_idx").on(table.storyId, table.taskKind),
    index("ai_tasks_provider_started_idx").on(table.provider, table.startedAt),
    index("ai_tasks_cost_started_idx").on(
      table.startedAt,
      table.estimatedCostMicros,
    ),
    check("ai_tasks_token_ck", sql`${table.inputTokens} >= 0 AND ${table.outputTokens} >= 0`),
    check("ai_tasks_cost_ck", sql`${table.estimatedCostMicros} >= 0`),
  ],
);

export const aiProviderHealth = sqliteTable(
  "ai_provider_health",
  {
    provider: text("provider").primaryKey(),
    state: text("state").notNull().default("UNKNOWN"),
    circuitState: text("circuit_state").notNull().default("CLOSED"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    latencyP95Ms: integer("latency_p95_ms"),
    lastSuccessAt: integer("last_success_at", { mode: "timestamp_ms" }),
    lastFailureAt: integer("last_failure_at", { mode: "timestamp_ms" }),
    openedUntil: integer("opened_until", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    check(
      "ai_provider_health_circuit_ck",
      sql`${table.circuitState} IN ('CLOSED','OPEN','HALF_OPEN')`,
    ),
  ],
);

export const aiCostLedger = sqliteTable(
  "ai_cost_ledger",
  {
    id: text("id").primaryKey(),
    dateUtc: text("date_utc").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    storyId: text("story_id").references(() => storyClusters.id, {
      onDelete: "set null",
    }),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costMicros: integer("cost_micros").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("ai_cost_ledger_scope_uq").on(
      table.dateUtc,
      table.provider,
      table.model,
      table.storyId,
    ),
    index("ai_cost_ledger_date_idx").on(table.dateUtc, table.costMicros),
    check("ai_cost_ledger_cost_ck", sql`${table.costMicros} >= 0`),
  ],
);
