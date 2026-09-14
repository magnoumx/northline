import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { users } from "./schema";

export const authChallenges = sqliteTable(
  "auth_challenges",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    emailHash: text("email_hash").notNull(),
    purpose: text("purpose").notNull(),
    tokenHash: text("token_hash").notNull(),
    redirectPath: text("redirect_path"),
    requestedIpHash: text("requested_ip_hash"),
    requestedUserAgentHash: text("requested_user_agent_hash"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
    invalidatedAt: integer("invalidated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("auth_challenges_token_uq").on(table.tokenHash),
    index("auth_challenges_email_purpose_idx").on(
      table.emailHash,
      table.purpose,
      table.expiresAt,
    ),
    check(
      "auth_challenges_purpose_ck",
      sql`${table.purpose} IN ('REGISTER','SIGN_IN','VERIFY_EMAIL','RESET_PASSWORD','DELETE_ACCOUNT','DATA_EXPORT')`,
    ),
  ],
);

export const authMfaChallenges = sqliteTable(
  "auth_mfa_challenges",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: text("session_id"),
    challengeHash: text("challenge_hash").notNull(),
    method: text("method").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("auth_mfa_challenges_hash_uq").on(table.challengeHash),
    index("auth_mfa_challenges_user_expiry_idx").on(
      table.userId,
      table.expiresAt,
    ),
    check("auth_mfa_challenges_attempt_ck", sql`${table.attemptCount} BETWEEN 0 AND 10`),
  ],
);

export const authAuditEvents = sqliteTable(
  "auth_audit_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    event: text("event").notNull(),
    decision: text("decision").notNull(),
    reason: text("reason"),
    sessionIdHash: text("session_id_hash"),
    clientIpHash: text("client_ip_hash"),
    userAgentHash: text("user_agent_hash"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("auth_audit_events_user_occurred_idx").on(
      table.userId,
      table.occurredAt,
    ),
    index("auth_audit_events_decision_idx").on(
      table.decision,
      table.occurredAt,
    ),
  ],
);

export const accountDataRequests = sqliteTable(
  "account_data_requests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    kind: text("kind").notNull(),
    state: text("state").notNull().default("REQUESTED"),
    idempotencyKeyHash: text("idempotency_key_hash").notNull(),
    requestedAt: integer("requested_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    outputStorageKey: text("output_storage_key"),
    failureCategory: text("failure_category"),
  },
  (table) => [
    uniqueIndex("account_data_requests_idempotency_uq").on(
      table.idempotencyKeyHash,
    ),
    index("account_data_requests_user_state_idx").on(table.userId, table.state),
    check(
      "account_data_requests_kind_ck",
      sql`${table.kind} IN ('EXPORT','DELETE')`,
    ),
  ],
);
