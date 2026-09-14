CREATE TABLE `settings_registry` (
  `id` text PRIMARY KEY NOT NULL,
  `key` text NOT NULL,
  `category` text NOT NULL,
  `environment` text NOT NULL,
  `value_json` text NOT NULL,
  `value_type` text NOT NULL,
  `is_secret_reference` integer DEFAULT false NOT NULL,
  `validation_schema` text NOT NULL,
  `default_value_json` text NOT NULL,
  `effective_value_json` text NOT NULL,
  `updated_by_id` text,
  `version` integer DEFAULT 1 NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `settings_registry_value_type_ck` CHECK(`value_type` IN ('string','number','boolean','json','string_list','secret_reference')),
  CONSTRAINT `settings_registry_version_ck` CHECK(`version` >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_registry_key_environment_uq` ON `settings_registry` (`key`,`environment`);
--> statement-breakpoint
CREATE INDEX `settings_registry_category_environment_idx` ON `settings_registry` (`category`,`environment`);
--> statement-breakpoint
CREATE TABLE `settings_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `setting_id` text NOT NULL,
  `version` integer NOT NULL,
  `value_json` text NOT NULL,
  `effective_value_json` text NOT NULL,
  `changed_by_id` text,
  `change_reason` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`setting_id`) REFERENCES `settings_registry`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`changed_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_versions_setting_version_uq` ON `settings_versions` (`setting_id`,`version`);
--> statement-breakpoint
CREATE INDEX `settings_versions_setting_created_idx` ON `settings_versions` (`setting_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `settings_audit_log` (
  `id` text PRIMARY KEY NOT NULL,
  `setting_id` text NOT NULL,
  `actor_id` text,
  `action` text NOT NULL,
  `from_version` integer,
  `to_version` integer NOT NULL,
  `metadata_json` text DEFAULT '{}' NOT NULL,
  `occurred_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`setting_id`) REFERENCES `settings_registry`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `settings_audit_log_setting_occurred_idx` ON `settings_audit_log` (`setting_id`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `settings_audit_log_actor_occurred_idx` ON `settings_audit_log` (`actor_id`,`occurred_at`);
--> statement-breakpoint
CREATE TABLE `integration_status` (
  `id` text PRIMARY KEY NOT NULL,
  `integration` text NOT NULL,
  `environment` text NOT NULL,
  `state` text NOT NULL,
  `last_tested_at` integer,
  `last_success_at` integer,
  `last_error_category` text,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  CONSTRAINT `integration_status_state_ck` CHECK(`state` IN ('CONFIGURED','MISSING','DISABLED','FAILED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integration_status_environment_integration_uq` ON `integration_status` (`environment`,`integration`);
--> statement-breakpoint
CREATE TRIGGER `settings_versions_no_update`
BEFORE UPDATE ON `settings_versions`
BEGIN
  SELECT RAISE(ABORT, 'setting version history is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `settings_versions_no_delete`
BEFORE DELETE ON `settings_versions`
BEGIN
  SELECT RAISE(ABORT, 'setting version history is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `settings_audit_log_no_update`
BEFORE UPDATE ON `settings_audit_log`
BEGIN
  SELECT RAISE(ABORT, 'settings audit history is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `settings_audit_log_no_delete`
BEFORE DELETE ON `settings_audit_log`
BEGIN
  SELECT RAISE(ABORT, 'settings audit history is append-only');
END;
