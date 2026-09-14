CREATE TABLE `article_assignments` (
	`article_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`assigned_by_id` text,
	`assigned_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`article_id`, `user_id`, `role`),
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`assigned_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "article_assignments_role_ck" CHECK("article_assignments"."role" IN ('WRITER','REVIEWER','EDITOR','MEDIA_REVIEWER','LEGAL_REVIEWER'))
);
--> statement-breakpoint
CREATE INDEX `article_assignments_user_role_idx` ON `article_assignments` (`user_id`,`role`);--> statement-breakpoint
CREATE TABLE `article_media` (
	`article_version_id` text NOT NULL,
	`media_asset_id` text NOT NULL,
	`role` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`alt_text` text NOT NULL,
	`caption` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`article_version_id`, `media_asset_id`, `role`),
	FOREIGN KEY (`article_version_id`) REFERENCES `article_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`media_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "article_media_role_ck" CHECK("article_media"."role" IN ('HERO','INLINE','SOCIAL','VIDEO','THUMBNAIL'))
);
--> statement-breakpoint
CREATE INDEX `article_media_version_position_idx` ON `article_media` (`article_version_id`,`position`);--> statement-breakpoint
CREATE TABLE `article_source_links` (
	`id` text PRIMARY KEY NOT NULL,
	`article_version_id` text NOT NULL,
	`source_id` text NOT NULL,
	`relationship` text NOT NULL,
	`summary` text NOT NULL,
	`citation_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`article_version_id`) REFERENCES `article_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "article_source_links_relationship_ck" CHECK("article_source_links"."relationship" IN ('PRIMARY','INDEPENDENT','CONTEXT','CONTRADICTS'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_source_links_version_source_uq` ON `article_source_links` (`article_version_id`,`source_id`);--> statement-breakpoint
CREATE INDEX `article_source_links_version_order_idx` ON `article_source_links` (`article_version_id`,`citation_order`);--> statement-breakpoint
CREATE TABLE `article_topics` (
	`article_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`relationship` text DEFAULT 'ABOUT' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`article_id`, `topic_id`),
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `content_topics`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `article_topics_topic_idx` ON `article_topics` (`topic_id`,`relationship`);--> statement-breakpoint
CREATE TABLE `content_redirects` (
	`id` text PRIMARY KEY NOT NULL,
	`source_path` text NOT NULL,
	`destination_path` text NOT NULL,
	`status_code` integer DEFAULT 301 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`reason` text NOT NULL,
	`created_by_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "content_redirects_status_ck" CHECK("content_redirects"."status_code" IN (301,302,307,308,410))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_redirects_source_uq` ON `content_redirects` (`source_path`);--> statement-breakpoint
CREATE TABLE `content_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`navigation_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_sections_slug_uq` ON `content_sections` (`slug`);--> statement-breakpoint
CREATE INDEX `content_sections_navigation_idx` ON `content_sections` (`active`,`navigation_order`);--> statement-breakpoint
CREATE TABLE `content_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'TOPIC' NOT NULL,
	`description` text,
	`canonical_url` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "content_topics_kind_ck" CHECK("content_topics"."kind" IN ('TOPIC','PERSON','COMPANY','TEAM','PLACE','EVENT'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_topics_kind_slug_uq` ON `content_topics` (`kind`,`slug`);--> statement-breakpoint
CREATE INDEX `content_topics_active_kind_idx` ON `content_topics` (`active`,`kind`);--> statement-breakpoint
CREATE TABLE `corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`from_version_id` text NOT NULL,
	`corrected_version_id` text NOT NULL,
	`summary` text NOT NULL,
	`severity` text DEFAULT 'STANDARD' NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`approved_by_id` text NOT NULL,
	`published_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`from_version_id`) REFERENCES `article_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`corrected_version_id`) REFERENCES `article_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `corrections_corrected_version_uq` ON `corrections` (`corrected_version_id`);--> statement-breakpoint
CREATE INDEX `corrections_article_published_idx` ON `corrections` (`article_id`,`published_at`);--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`storage_key` text NOT NULL,
	`public_url` text,
	`workflow_state` text DEFAULT 'UPLOADED' NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`frame_count` integer,
	`checksum_sha256` text NOT NULL,
	`creator` text,
	`copyright_owner` text,
	`original_url` text,
	`license` text,
	`license_url` text,
	`usage_permission` text,
	`attribution` text,
	`downloaded_at` integer,
	`expires_at` integer,
	`verification_state` text DEFAULT 'UNVERIFIED' NOT NULL,
	`malware_scan_reference` text,
	`metadata_stripped_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "media_assets_byte_size_ck" CHECK("media_assets"."byte_size" > 0),
	CONSTRAINT "media_assets_workflow_ck" CHECK("media_assets"."workflow_state" IN ('UPLOADED','QUARANTINED','VALIDATING','SCANNING','RIGHTS_REVIEW','APPROVED','REJECTED','EXPIRED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_assets_storage_key_uq` ON `media_assets` (`storage_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `media_assets_checksum_uq` ON `media_assets` (`checksum_sha256`);--> statement-breakpoint
CREATE INDEX `media_assets_workflow_idx` ON `media_assets` (`workflow_state`,`verification_state`);--> statement-breakpoint
CREATE TABLE `research_dossiers` (
	`id` text PRIMARY KEY NOT NULL,
	`story_cluster_id` text NOT NULL,
	`state` text DEFAULT 'RESEARCHING' NOT NULL,
	`approved_outline_json` text,
	`verified_claims_json` text DEFAULT '[]' NOT NULL,
	`attributed_quotes_json` text DEFAULT '[]' NOT NULL,
	`source_summaries_json` text DEFAULT '[]' NOT NULL,
	`explicit_unknowns_json` text DEFAULT '[]' NOT NULL,
	`input_hash` text NOT NULL,
	`approved_by_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`story_cluster_id`) REFERENCES `story_clusters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `research_dossiers_cluster_hash_uq` ON `research_dossiers` (`story_cluster_id`,`input_hash`);--> statement-breakpoint
CREATE INDEX `research_dossiers_state_idx` ON `research_dossiers` (`state`,`updated_at`);--> statement-breakpoint
CREATE TABLE `seo_briefs` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`primary_reader_intent` text NOT NULL,
	`primary_query` text,
	`secondary_queries_json` text DEFAULT '[]' NOT NULL,
	`entities_json` text DEFAULT '[]' NOT NULL,
	`questions_json` text DEFAULT '[]' NOT NULL,
	`competing_coverage_json` text DEFAULT '[]' NOT NULL,
	`missing_reader_value` text NOT NULL,
	`recommended_format` text NOT NULL,
	`headline_direction` text NOT NULL,
	`internal_links_json` text DEFAULT '[]' NOT NULL,
	`media_json` text DEFAULT '[]' NOT NULL,
	`freshness_plan` text NOT NULL,
	`update_triggers_json` text DEFAULT '[]' NOT NULL,
	`demand_estimate` text DEFAULT 'UNKNOWN' NOT NULL,
	`approved_by_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "seo_briefs_demand_ck" CHECK("seo_briefs"."demand_estimate" IN ('UNKNOWN','LOW','MEDIUM','HIGH'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seo_briefs_article_uq` ON `seo_briefs` (`article_id`);--> statement-breakpoint
CREATE TABLE `source_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`dossier_id` text,
	`original_url` text NOT NULL,
	`normalized_url` text NOT NULL,
	`storage_key` text,
	`content_hash` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`permission_basis` text NOT NULL,
	`sanitized_text` text,
	`untrusted_data` integer DEFAULT true NOT NULL,
	`fetched_at` integer NOT NULL,
	`expires_at` integer,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`dossier_id`) REFERENCES `research_dossiers`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "source_snapshots_size_ck" CHECK("source_snapshots"."byte_size" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_snapshots_source_hash_uq` ON `source_snapshots` (`source_id`,`content_hash`);--> statement-breakpoint
CREATE INDEX `source_snapshots_dossier_idx` ON `source_snapshots` (`dossier_id`,`fetched_at`);--> statement-breakpoint
CREATE TABLE `story_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`story_cluster_id` text NOT NULL,
	`article_version_id` text,
	`headline` text NOT NULL,
	`body` text NOT NULL,
	`verification_state` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`story_cluster_id`) REFERENCES `story_clusters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`article_version_id`) REFERENCES `article_versions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `story_updates_cluster_published_idx` ON `story_updates` (`story_cluster_id`,`published_at`);--> statement-breakpoint
CREATE TABLE `ai_cost_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`date_utc` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`story_id` text,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cost_micros` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`story_id`) REFERENCES `story_clusters`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ai_cost_ledger_cost_ck" CHECK("ai_cost_ledger"."cost_micros" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_cost_ledger_scope_uq` ON `ai_cost_ledger` (`date_utc`,`provider`,`model`,`story_id`);--> statement-breakpoint
CREATE INDEX `ai_cost_ledger_date_idx` ON `ai_cost_ledger` (`date_utc`,`cost_micros`);--> statement-breakpoint
CREATE TABLE `ai_prompt_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`task_kind` text NOT NULL,
	`version` text NOT NULL,
	`policy_version` text NOT NULL,
	`template_hash` text NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_prompt_versions_kind_version_uq` ON `ai_prompt_versions` (`task_kind`,`version`);--> statement-breakpoint
CREATE INDEX `ai_prompt_versions_active_idx` ON `ai_prompt_versions` (`task_kind`,`active`);--> statement-breakpoint
CREATE TABLE `ai_provider_health` (
	`provider` text PRIMARY KEY NOT NULL,
	`state` text DEFAULT 'UNKNOWN' NOT NULL,
	`circuit_state` text DEFAULT 'CLOSED' NOT NULL,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`latency_p95_ms` integer,
	`last_success_at` integer,
	`last_failure_at` integer,
	`opened_until` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "ai_provider_health_circuit_ck" CHECK("ai_provider_health"."circuit_state" IN ('CLOSED','OPEN','HALF_OPEN'))
);
--> statement-breakpoint
CREATE TABLE `ai_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`task_kind` text NOT NULL,
	`story_id` text,
	`dossier_id` text,
	`input_content_hash` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`prompt_version` text NOT NULL,
	`policy_version` text NOT NULL,
	`data_class` text DEFAULT 'PUBLIC' NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`estimated_cost_micros` integer DEFAULT 0 NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`structured_output_valid` integer,
	`evidence_ids_json` text DEFAULT '[]' NOT NULL,
	`result_disposition` text NOT NULL,
	`error_category` text,
	`output_json` text,
	`request_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`story_id`) REFERENCES `story_clusters`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`dossier_id`) REFERENCES `research_dossiers`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "ai_tasks_token_ck" CHECK("ai_tasks"."input_tokens" >= 0 AND "ai_tasks"."output_tokens" >= 0),
	CONSTRAINT "ai_tasks_cost_ck" CHECK("ai_tasks"."estimated_cost_micros" >= 0)
);
--> statement-breakpoint
CREATE INDEX `ai_tasks_story_kind_idx` ON `ai_tasks` (`story_id`,`task_kind`);--> statement-breakpoint
CREATE INDEX `ai_tasks_provider_started_idx` ON `ai_tasks` (`provider`,`started_at`);--> statement-breakpoint
CREATE INDEX `ai_tasks_cost_started_idx` ON `ai_tasks` (`started_at`,`estimated_cost_micros`);--> statement-breakpoint
CREATE TABLE `connector_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`connector_id` text NOT NULL,
	`provider` text NOT NULL,
	`state` text NOT NULL,
	`credentials_state` text NOT NULL,
	`terms_notes` text NOT NULL,
	`rate_limit_json` text DEFAULT '{}' NOT NULL,
	`markets_json` text DEFAULT '[]' NOT NULL,
	`categories_json` text DEFAULT '[]' NOT NULL,
	`cost_micros` integer DEFAULT 0 NOT NULL,
	`item_count` integer DEFAULT 0 NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`error_category` text,
	`error_digest` text,
	`circuit_state` text DEFAULT 'CLOSED' NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "connector_runs_cost_ck" CHECK("connector_runs"."cost_micros" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connector_runs_connector_started_uq` ON `connector_runs` (`connector_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `connector_runs_state_started_idx` ON `connector_runs` (`state`,`started_at`);--> statement-breakpoint
CREATE TABLE `trend_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`connector_run_id` text NOT NULL,
	`external_id_hash` text NOT NULL,
	`title` text NOT NULL,
	`normalized_title` text NOT NULL,
	`source_url` text NOT NULL,
	`source_published_at` integer,
	`market` text DEFAULT 'US' NOT NULL,
	`category` text,
	`signal_value` integer DEFAULT 0 NOT NULL,
	`attribution` text,
	`trend_id` text,
	`detected_at` integer NOT NULL,
	FOREIGN KEY (`connector_run_id`) REFERENCES `connector_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trend_id`) REFERENCES `trends`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trend_signals_connector_external_uq` ON `trend_signals` (`connector_run_id`,`external_id_hash`);--> statement-breakpoint
CREATE INDEX `trend_signals_market_detected_idx` ON `trend_signals` (`market`,`detected_at`);--> statement-breakpoint
CREATE TABLE `account_data_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`state` text DEFAULT 'REQUESTED' NOT NULL,
	`idempotency_key_hash` text NOT NULL,
	`requested_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`completed_at` integer,
	`expires_at` integer,
	`output_storage_key` text,
	`failure_category` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "account_data_requests_kind_ck" CHECK("account_data_requests"."kind" IN ('EXPORT','DELETE'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_data_requests_idempotency_uq` ON `account_data_requests` (`idempotency_key_hash`);--> statement-breakpoint
CREATE INDEX `account_data_requests_user_state_idx` ON `account_data_requests` (`user_id`,`state`);--> statement-breakpoint
CREATE TABLE `auth_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`event` text NOT NULL,
	`decision` text NOT NULL,
	`reason` text,
	`session_id_hash` text,
	`client_ip_hash` text,
	`user_agent_hash` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`occurred_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `auth_audit_events_user_occurred_idx` ON `auth_audit_events` (`user_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `auth_audit_events_decision_idx` ON `auth_audit_events` (`decision`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `auth_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`email_hash` text NOT NULL,
	`purpose` text NOT NULL,
	`token_hash` text NOT NULL,
	`redirect_path` text,
	`requested_ip_hash` text,
	`requested_user_agent_hash` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`invalidated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "auth_challenges_purpose_ck" CHECK("auth_challenges"."purpose" IN ('REGISTER','SIGN_IN','VERIFY_EMAIL','RESET_PASSWORD','DELETE_ACCOUNT','DATA_EXPORT'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_challenges_token_uq` ON `auth_challenges` (`token_hash`);--> statement-breakpoint
CREATE INDEX `auth_challenges_email_purpose_idx` ON `auth_challenges` (`email_hash`,`purpose`,`expires_at`);--> statement-breakpoint
CREATE TABLE `auth_mfa_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text,
	`challenge_hash` text NOT NULL,
	`method` text NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`expires_at` integer NOT NULL,
	`verified_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "auth_mfa_challenges_attempt_ck" CHECK("auth_mfa_challenges"."attempt_count" BETWEEN 0 AND 10)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_mfa_challenges_hash_uq` ON `auth_mfa_challenges` (`challenge_hash`);--> statement-breakpoint
CREATE INDEX `auth_mfa_challenges_user_expiry_idx` ON `auth_mfa_challenges` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `backup_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`environment` text NOT NULL,
	`state` text NOT NULL,
	`provider_reference_hash` text,
	`object_count` integer,
	`byte_count` integer,
	`data_digest` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`restored_at` integer,
	`reconciliation_json` text,
	`error_category` text,
	CONSTRAINT "backup_runs_kind_ck" CHECK("backup_runs"."kind" IN ('DATABASE','OBJECT_STORAGE','CONFIGURATION','MIGRATION','RESTORE_REHEARSAL'))
);
--> statement-breakpoint
CREATE INDEX `backup_runs_kind_started_idx` ON `backup_runs` (`kind`,`started_at`);--> statement-breakpoint
CREATE TABLE `durable_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`queue` text NOT NULL,
	`kind` text NOT NULL,
	`idempotency_key_hash` text NOT NULL,
	`state` text DEFAULT 'QUEUED' NOT NULL,
	`priority` integer DEFAULT 100 NOT NULL,
	`payload_json` text NOT NULL,
	`payload_hash` text NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`maximum_attempts` integer DEFAULT 5 NOT NULL,
	`available_at` integer NOT NULL,
	`timeout_at` integer,
	`locked_by` text,
	`locked_until` integer,
	`cancelled_at` integer,
	`completed_at` integer,
	`error_category` text,
	`error_digest` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "durable_jobs_attempt_ck" CHECK("durable_jobs"."attempt_count" >= 0 AND "durable_jobs"."maximum_attempts" BETWEEN 1 AND 20)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `durable_jobs_idempotency_uq` ON `durable_jobs` (`idempotency_key_hash`);--> statement-breakpoint
CREATE INDEX `durable_jobs_claim_idx` ON `durable_jobs` (`queue`,`state`,`available_at`,`priority`);--> statement-breakpoint
CREATE INDEX `durable_jobs_lease_idx` ON `durable_jobs` (`locked_until`,`state`);--> statement-breakpoint
CREATE TABLE `indexing_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`enabled` integer NOT NULL,
	`environment` text NOT NULL,
	`checklist_hash` text NOT NULL,
	`owner_id` text NOT NULL,
	`reason` text NOT NULL,
	`occurred_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `indexing_changes_occurred_idx` ON `indexing_changes` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `job_dead_letters` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`final_error_category` text NOT NULL,
	`final_error_digest` text NOT NULL,
	`replayed_as_job_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `durable_jobs`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`replayed_as_job_id`) REFERENCES `durable_jobs`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_dead_letters_job_uq` ON `job_dead_letters` (`job_id`);--> statement-breakpoint
CREATE INDEX `job_dead_letters_created_idx` ON `job_dead_letters` (`created_at`);--> statement-breakpoint
CREATE TABLE `newsletter_delivery_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`issue_id` text NOT NULL,
	`subscriber_id` text NOT NULL,
	`idempotency_key_hash` text NOT NULL,
	`provider` text NOT NULL,
	`provider_message_id_hash` text,
	`state` text NOT NULL,
	`attempted_at` integer NOT NULL,
	`delivered_at` integer,
	`bounced_at` integer,
	`complained_at` integer,
	`error_category` text,
	FOREIGN KEY (`issue_id`) REFERENCES `newsletter_issues`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`subscriber_id`) REFERENCES `newsletter_subscribers`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_delivery_idempotency_uq` ON `newsletter_delivery_logs` (`idempotency_key_hash`);--> statement-breakpoint
CREATE INDEX `newsletter_delivery_issue_state_idx` ON `newsletter_delivery_logs` (`issue_id`,`state`);--> statement-breakpoint
CREATE TABLE `newsletter_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`subject` text NOT NULL,
	`preview_text` text NOT NULL,
	`body_html_sanitized` text NOT NULL,
	`body_text` text NOT NULL,
	`state` text DEFAULT 'DRAFT' NOT NULL,
	`scheduled_at` integer,
	`approved_by_id` text,
	`sent_at` integer,
	`sensitive` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_issues_slug_uq` ON `newsletter_issues` (`slug`);--> statement-breakpoint
CREATE INDEX `newsletter_issues_state_schedule_idx` ON `newsletter_issues` (`state`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `newsletter_preferences_v3` (
	`subscriber_id` text PRIMARY KEY NOT NULL,
	`products_json` text DEFAULT '[]' NOT NULL,
	`topics_json` text DEFAULT '[]' NOT NULL,
	`frequency` text DEFAULT 'WEEKDAY' NOT NULL,
	`paused_until` integer,
	`tracking_consent` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`subscriber_id`) REFERENCES `newsletter_subscribers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `newsletter_suppressions` (
	`id` text PRIMARY KEY NOT NULL,
	`email_hash` text NOT NULL,
	`reason` text NOT NULL,
	`provider_event_id_hash` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`lifted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_suppressions_email_reason_uq` ON `newsletter_suppressions` (`email_hash`,`reason`);--> statement-breakpoint
CREATE INDEX `newsletter_suppressions_active_idx` ON `newsletter_suppressions` (`email_hash`,`lifted_at`);--> statement-breakpoint
CREATE TABLE `newsletter_webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`provider_event_id_hash` text NOT NULL,
	`event_type` text NOT NULL,
	`signature_valid` integer NOT NULL,
	`payload_hash` text NOT NULL,
	`received_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`processed_at` integer,
	`error_category` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_webhook_provider_event_uq` ON `newsletter_webhook_events` (`provider`,`provider_event_id_hash`);--> statement-breakpoint
CREATE TABLE `operational_events` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`severity` text NOT NULL,
	`service` text NOT NULL,
	`event` text NOT NULL,
	`value` integer,
	`threshold` integer,
	`correlation_id` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`occurred_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `operational_events_service_occurred_idx` ON `operational_events` (`service`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `operational_events_severity_idx` ON `operational_events` (`severity`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`sensitive` integer DEFAULT false NOT NULL,
	`updated_by_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);--> statement-breakpoint
-- A published article version and its evidence packet are an immutable
-- historical record. Corrections and material updates must create a new
-- version, then move the article pointer in the same D1 batch.
DROP TRIGGER IF EXISTS `published_article_versions_immutable_update`;--> statement-breakpoint
CREATE TRIGGER `published_article_versions_immutable_update`
BEFORE UPDATE ON `article_versions`
WHEN OLD.`published_at` IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'published article versions are immutable');
END;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_article_versions_immutable_delete`;--> statement-breakpoint
CREATE TRIGGER `published_article_versions_immutable_delete`
BEFORE DELETE ON `article_versions`
WHEN OLD.`published_at` IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'published article versions cannot be deleted');
END;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_claims_immutable_insert`;--> statement-breakpoint
CREATE TRIGGER `published_claims_immutable_insert`
BEFORE INSERT ON `claims`
WHEN EXISTS (
  SELECT 1 FROM `article_versions`
  WHERE `id` = NEW.`article_version_id`
    AND `published_at` IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'published claims are immutable');
END;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_claims_immutable_update`;--> statement-breakpoint
CREATE TRIGGER `published_claims_immutable_update`
BEFORE UPDATE ON `claims`
WHEN EXISTS (
  SELECT 1 FROM `article_versions`
  WHERE `id` = OLD.`article_version_id`
    AND `published_at` IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'published claims are immutable');
END;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_claims_immutable_delete`;--> statement-breakpoint
CREATE TRIGGER `published_claims_immutable_delete`
BEFORE DELETE ON `claims`
WHEN EXISTS (
  SELECT 1 FROM `article_versions`
  WHERE `id` = OLD.`article_version_id`
    AND `published_at` IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'published claims are immutable');
END;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_evidence_immutable_insert`;--> statement-breakpoint
CREATE TRIGGER `published_evidence_immutable_insert`
BEFORE INSERT ON `evidence`
WHEN EXISTS (
  SELECT 1
  FROM `claims`
  INNER JOIN `article_versions`
    ON `article_versions`.`id` = `claims`.`article_version_id`
  WHERE `claims`.`id` = NEW.`claim_id`
    AND `article_versions`.`published_at` IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'published evidence is immutable');
END;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_evidence_immutable_update`;--> statement-breakpoint
CREATE TRIGGER `published_evidence_immutable_update`
BEFORE UPDATE ON `evidence`
WHEN EXISTS (
  SELECT 1
  FROM `claims`
  INNER JOIN `article_versions`
    ON `article_versions`.`id` = `claims`.`article_version_id`
  WHERE `claims`.`id` = OLD.`claim_id`
    AND `article_versions`.`published_at` IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'published evidence is immutable');
END;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_evidence_immutable_delete`;--> statement-breakpoint
CREATE TRIGGER `published_evidence_immutable_delete`
BEFORE DELETE ON `evidence`
WHEN EXISTS (
  SELECT 1
  FROM `claims`
  INNER JOIN `article_versions`
    ON `article_versions`.`id` = `claims`.`article_version_id`
  WHERE `claims`.`id` = OLD.`claim_id`
    AND `article_versions`.`published_at` IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'published evidence is immutable');
END;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_source_links_immutable_insert`;--> statement-breakpoint
CREATE TRIGGER `published_source_links_immutable_insert`
BEFORE INSERT ON `article_source_links`
WHEN EXISTS (
  SELECT 1 FROM `article_versions`
  WHERE `id` = NEW.`article_version_id`
    AND `published_at` IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'published source links are immutable');
END;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_source_links_immutable_update`;--> statement-breakpoint
CREATE TRIGGER `published_source_links_immutable_update`
BEFORE UPDATE ON `article_source_links`
WHEN EXISTS (
  SELECT 1 FROM `article_versions`
  WHERE `id` = OLD.`article_version_id`
    AND `published_at` IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'published source links are immutable');
END;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_source_links_immutable_delete`;--> statement-breakpoint
CREATE TRIGGER `published_source_links_immutable_delete`
BEFORE DELETE ON `article_source_links`
WHEN EXISTS (
  SELECT 1 FROM `article_versions`
  WHERE `id` = OLD.`article_version_id`
    AND `published_at` IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'published source links are immutable');
END;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_media_links_immutable_insert`;--> statement-breakpoint
CREATE TRIGGER `published_media_links_immutable_insert`
BEFORE INSERT ON `article_media`
WHEN EXISTS (
  SELECT 1 FROM `article_versions`
  WHERE `id` = NEW.`article_version_id`
    AND `published_at` IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'published media links are immutable');
END;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_media_links_immutable_update`;--> statement-breakpoint
CREATE TRIGGER `published_media_links_immutable_update`
BEFORE UPDATE ON `article_media`
WHEN EXISTS (
  SELECT 1 FROM `article_versions`
  WHERE `id` = OLD.`article_version_id`
    AND `published_at` IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'published media links are immutable');
END;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_media_links_immutable_delete`;--> statement-breakpoint
CREATE TRIGGER `published_media_links_immutable_delete`
BEFORE DELETE ON `article_media`
WHEN EXISTS (
  SELECT 1 FROM `article_versions`
  WHERE `id` = OLD.`article_version_id`
    AND `published_at` IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'published media links are immutable');
END;
