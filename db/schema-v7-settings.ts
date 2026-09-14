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

export const settingsRegistry = sqliteTable(
  "settings_registry",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    category: text("category").notNull(),
    environment: text("environment").notNull(),
    valueJson: text("value_json").notNull(),
    valueType: text("value_type").notNull(),
    isSecretReference: integer("is_secret_reference", { mode: "boolean" })
      .notNull()
      .default(false),
    validationSchema: text("validation_schema").notNull(),
    defaultValueJson: text("default_value_json").notNull(),
    effectiveValueJson: text("effective_value_json").notNull(),
    updatedById: text("updated_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    version: integer("version").notNull().default(1),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("settings_registry_key_environment_uq").on(
      table.key,
      table.environment,
    ),
    index("settings_registry_category_environment_idx").on(
      table.category,
      table.environment,
    ),
    check(
      "settings_registry_value_type_ck",
      sql`${table.valueType} IN ('string','number','boolean','json','string_list','secret_reference')`,
    ),
    check("settings_registry_version_ck", sql`${table.version} >= 1`),
  ],
);

export const settingsVersions = sqliteTable(
  "settings_versions",
  {
    id: text("id").primaryKey(),
    settingId: text("setting_id")
      .notNull()
      .references(() => settingsRegistry.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    valueJson: text("value_json").notNull(),
    effectiveValueJson: text("effective_value_json").notNull(),
    changedById: text("changed_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    changeReason: text("change_reason").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("settings_versions_setting_version_uq").on(
      table.settingId,
      table.version,
    ),
    index("settings_versions_setting_created_idx").on(
      table.settingId,
      table.createdAt,
    ),
  ],
);

export const settingsAuditLog = sqliteTable(
  "settings_audit_log",
  {
    id: text("id").primaryKey(),
    settingId: text("setting_id")
      .notNull()
      .references(() => settingsRegistry.id, { onDelete: "restrict" }),
    actorId: text("actor_id").references(() => users.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    fromVersion: integer("from_version"),
    toVersion: integer("to_version").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("settings_audit_log_setting_occurred_idx").on(
      table.settingId,
      table.occurredAt,
    ),
    index("settings_audit_log_actor_occurred_idx").on(
      table.actorId,
      table.occurredAt,
    ),
  ],
);

export const integrationStatus = sqliteTable(
  "integration_status",
  {
    id: text("id").primaryKey(),
    integration: text("integration").notNull(),
    environment: text("environment").notNull(),
    state: text("state").notNull(),
    lastTestedAt: integer("last_tested_at", { mode: "timestamp_ms" }),
    lastSuccessAt: integer("last_success_at", { mode: "timestamp_ms" }),
    lastErrorCategory: text("last_error_category"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("integration_status_environment_integration_uq").on(
      table.environment,
      table.integration,
    ),
    check(
      "integration_status_state_ck",
      sql`${table.state} IN ('CONFIGURED','MISSING','DISABLED','FAILED')`,
    ),
  ],
);
