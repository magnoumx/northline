import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { newsletterSubscribers, users } from "./schema";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

export const durableJobs = sqliteTable(
  "durable_jobs",
  {
    id: text("id").primaryKey(),
    queue: text("queue").notNull(),
    kind: text("kind").notNull(),
    idempotencyKeyHash: text("idempotency_key_hash").notNull(),
    state: text("state").notNull().default("QUEUED"),
    priority: integer("priority").notNull().default(100),
    payloadJson: text("payload_json").notNull(),
    payloadHash: text("payload_hash").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    maximumAttempts: integer("maximum_attempts").notNull().default(5),
    availableAt: integer("available_at", { mode: "timestamp_ms" }).notNull(),
    timeoutAt: integer("timeout_at", { mode: "timestamp_ms" }),
    lockedBy: text("locked_by"),
    lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
    cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    errorCategory: text("error_category"),
    errorDigest: text("error_digest"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("durable_jobs_idempotency_uq").on(table.idempotencyKeyHash),
    index("durable_jobs_claim_idx").on(
      table.queue,
      table.state,
      table.availableAt,
      table.priority,
    ),
    index("durable_jobs_lease_idx").on(table.lockedUntil, table.state),
    check("durable_jobs_attempt_ck", sql`${table.attemptCount} >= 0 AND ${table.maximumAttempts} BETWEEN 1 AND 20`),
  ],
);

export const jobDeadLetters = sqliteTable(
  "job_dead_letters",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => durableJobs.id, { onDelete: "restrict" }),
    payloadHash: text("payload_hash").notNull(),
    finalErrorCategory: text("final_error_category").notNull(),
    finalErrorDigest: text("final_error_digest").notNull(),
    replayedAsJobId: text("replayed_as_job_id").references(
      () => durableJobs.id,
      { onDelete: "restrict" },
    ),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("job_dead_letters_job_uq").on(table.jobId),
    index("job_dead_letters_created_idx").on(table.createdAt),
  ],
);

export const siteSettings = sqliteTable(
  "site_settings",
  {
    key: text("key").primaryKey(),
    valueJson: text("value_json").notNull(),
    sensitive: integer("sensitive", { mode: "boolean" })
      .notNull()
      .default(false),
    updatedById: text("updated_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    ...timestamps,
  },
);

export const indexingChanges = sqliteTable(
  "indexing_changes",
  {
    id: text("id").primaryKey(),
    enabled: integer("enabled", { mode: "boolean" }).notNull(),
    environment: text("environment").notNull(),
    checklistHash: text("checklist_hash").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("indexing_changes_occurred_idx").on(table.occurredAt)],
);

export const operationalEvents = sqliteTable(
  "operational_events",
  {
    id: text("id").primaryKey(),
    category: text("category").notNull(),
    severity: text("severity").notNull(),
    service: text("service").notNull(),
    event: text("event").notNull(),
    value: integer("value"),
    threshold: integer("threshold"),
    correlationId: text("correlation_id"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("operational_events_service_occurred_idx").on(
      table.service,
      table.occurredAt,
    ),
    index("operational_events_severity_idx").on(
      table.severity,
      table.occurredAt,
    ),
  ],
);

export const backupRuns = sqliteTable(
  "backup_runs",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    environment: text("environment").notNull(),
    state: text("state").notNull(),
    providerReferenceHash: text("provider_reference_hash"),
    objectCount: integer("object_count"),
    byteCount: integer("byte_count"),
    dataDigest: text("data_digest"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    restoredAt: integer("restored_at", { mode: "timestamp_ms" }),
    reconciliationJson: text("reconciliation_json"),
    errorCategory: text("error_category"),
  },
  (table) => [
    index("backup_runs_kind_started_idx").on(table.kind, table.startedAt),
    check(
      "backup_runs_kind_ck",
      sql`${table.kind} IN ('DATABASE','OBJECT_STORAGE','CONFIGURATION','MIGRATION','RESTORE_REHEARSAL')`,
    ),
  ],
);

export const newsletterPreferencesV3 = sqliteTable(
  "newsletter_preferences_v3",
  {
    subscriberId: text("subscriber_id")
      .primaryKey()
      .references(() => newsletterSubscribers.id, { onDelete: "cascade" }),
    productsJson: text("products_json").notNull().default("[]"),
    topicsJson: text("topics_json").notNull().default("[]"),
    frequency: text("frequency").notNull().default("WEEKDAY"),
    pausedUntil: integer("paused_until", { mode: "timestamp_ms" }),
    trackingConsent: integer("tracking_consent", { mode: "boolean" })
      .notNull()
      .default(false),
    ...timestamps,
  },
);

export const newsletterSuppressions = sqliteTable(
  "newsletter_suppressions",
  {
    id: text("id").primaryKey(),
    emailHash: text("email_hash").notNull(),
    reason: text("reason").notNull(),
    providerEventIdHash: text("provider_event_id_hash"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    liftedAt: integer("lifted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("newsletter_suppressions_email_reason_uq").on(
      table.emailHash,
      table.reason,
    ),
    index("newsletter_suppressions_active_idx").on(
      table.emailHash,
      table.liftedAt,
    ),
  ],
);

export const newsletterIssues = sqliteTable(
  "newsletter_issues",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    subject: text("subject").notNull(),
    previewText: text("preview_text").notNull(),
    bodyHtmlSanitized: text("body_html_sanitized").notNull(),
    bodyText: text("body_text").notNull(),
    state: text("state").notNull().default("DRAFT"),
    scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
    approvedById: text("approved_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    sensitive: integer("sensitive", { mode: "boolean" })
      .notNull()
      .default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("newsletter_issues_slug_uq").on(table.slug),
    index("newsletter_issues_state_schedule_idx").on(
      table.state,
      table.scheduledAt,
    ),
  ],
);

export const newsletterDeliveryLogs = sqliteTable(
  "newsletter_delivery_logs",
  {
    id: text("id").primaryKey(),
    issueId: text("issue_id")
      .notNull()
      .references(() => newsletterIssues.id, { onDelete: "restrict" }),
    subscriberId: text("subscriber_id")
      .notNull()
      .references(() => newsletterSubscribers.id, { onDelete: "restrict" }),
    idempotencyKeyHash: text("idempotency_key_hash").notNull(),
    provider: text("provider").notNull(),
    providerMessageIdHash: text("provider_message_id_hash"),
    state: text("state").notNull(),
    attemptedAt: integer("attempted_at", { mode: "timestamp_ms" }).notNull(),
    deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
    bouncedAt: integer("bounced_at", { mode: "timestamp_ms" }),
    complainedAt: integer("complained_at", { mode: "timestamp_ms" }),
    errorCategory: text("error_category"),
  },
  (table) => [
    uniqueIndex("newsletter_delivery_idempotency_uq").on(
      table.idempotencyKeyHash,
    ),
    index("newsletter_delivery_issue_state_idx").on(table.issueId, table.state),
  ],
);

export const newsletterWebhookEvents = sqliteTable(
  "newsletter_webhook_events",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    providerEventIdHash: text("provider_event_id_hash").notNull(),
    eventType: text("event_type").notNull(),
    signatureValid: integer("signature_valid", { mode: "boolean" }).notNull(),
    payloadHash: text("payload_hash").notNull(),
    receivedAt: integer("received_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    processedAt: integer("processed_at", { mode: "timestamp_ms" }),
    errorCategory: text("error_category"),
  },
  (table) => [
    uniqueIndex("newsletter_webhook_provider_event_uq").on(
      table.provider,
      table.providerEventIdHash,
    ),
  ],
);
