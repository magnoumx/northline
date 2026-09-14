CREATE TABLE `article_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`version` integer NOT NULL,
	`headline` text NOT NULL,
	`subheadline` text,
	`body_json` text NOT NULL,
	`key_takeaways_json` text DEFAULT '[]' NOT NULL,
	`seo_json` text DEFAULT '{}' NOT NULL,
	`structured_data_json` text DEFAULT '{}' NOT NULL,
	`quality_score` integer DEFAULT 0 NOT NULL,
	`quality_explanation_json` text DEFAULT '{}' NOT NULL,
	`change_summary` text NOT NULL,
	`created_by_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_versions_article_version_uq` ON `article_versions` (`article_id`,`version`);--> statement-breakpoint
CREATE INDEX `article_versions_created_idx` ON `article_versions` (`article_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`story_cluster_id` text,
	`slug` text NOT NULL,
	`category` text NOT NULL,
	`format` text NOT NULL,
	`state` text DEFAULT 'DRAFTING' NOT NULL,
	`risk_level` text DEFAULT 'LOW' NOT NULL,
	`sensitive` integer DEFAULT false NOT NULL,
	`human_approval_required` integer DEFAULT false NOT NULL,
	`author_id` text,
	`current_version_id` text,
	`published_at` integer,
	`scheduled_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`story_cluster_id`) REFERENCES `story_clusters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_slug_uq` ON `articles` (`slug`);--> statement-breakpoint
CREATE INDEX `articles_state_published_idx` ON `articles` (`state`,`published_at`);--> statement-breakpoint
CREATE INDEX `articles_cluster_idx` ON `articles` (`story_cluster_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`decision` text NOT NULL,
	`reason` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`ip_hash` text,
	`occurred_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_logs_target_idx` ON `audit_logs` (`target_type`,`target_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_idx` ON `audit_logs` (`actor_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `claims` (
	`id` text PRIMARY KEY NOT NULL,
	`article_version_id` text NOT NULL,
	`claim_text` text NOT NULL,
	`article_section` text NOT NULL,
	`category` text NOT NULL,
	`importance` text DEFAULT 'supporting' NOT NULL,
	`primary_evidence_available` integer DEFAULT false NOT NULL,
	`verification_status` text DEFAULT 'UNVERIFIED' NOT NULL,
	`risk_level` text DEFAULT 'LOW' NOT NULL,
	`reviewer_id` text,
	`review_notes` text,
	`verified_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`article_version_id`) REFERENCES `article_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `claims_version_status_idx` ON `claims` (`article_version_id`,`verification_status`);--> statement-breakpoint
CREATE INDEX `claims_importance_idx` ON `claims` (`importance`);--> statement-breakpoint
CREATE TABLE `connectors` (
	`id` text PRIMARY KEY NOT NULL,
	`source_name` text NOT NULL,
	`connector_type` text NOT NULL,
	`permitted_usage` text NOT NULL,
	`rate_limits_json` text DEFAULT '{}' NOT NULL,
	`attribution_rules` text,
	`caching_rules` text,
	`supported_markets_json` text DEFAULT '[]' NOT NULL,
	`supported_categories_json` text DEFAULT '[]' NOT NULL,
	`last_successful_sync_at` integer,
	`last_failure_at` integer,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`circuit_breaker_status` text DEFAULT 'CLOSED' NOT NULL,
	`health_score` integer DEFAULT 100 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connectors_name_uq` ON `connectors` (`source_name`);--> statement-breakpoint
CREATE INDEX `connectors_health_idx` ON `connectors` (`health_score`);--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`claim_id` text NOT NULL,
	`source_id` text NOT NULL,
	`relationship` text NOT NULL,
	`source_locator` text NOT NULL,
	`snapshot_url` text,
	`excerpt_hash` text,
	`observed_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`claim_id`) REFERENCES `claims`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `evidence_claim_idx` ON `evidence` (`claim_id`);--> statement-breakpoint
CREATE INDEX `evidence_source_idx` ON `evidence` (`source_id`);--> statement-breakpoint
CREATE TABLE `follows` (
	`user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `target_type`, `target_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `follows_target_idx` ON `follows` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `job_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`job_type` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`state` text NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`input_hash` text NOT NULL,
	`output_json` text,
	`error_code` text,
	`error_message` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`next_retry_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_runs_idempotency_uq` ON `job_runs` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `job_runs_state_retry_idx` ON `job_runs` (`state`,`next_retry_at`);--> statement-breakpoint
CREATE TABLE `newsletter_subscribers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`list` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`consent_source` text NOT NULL,
	`confirmation_token_hash` text NOT NULL,
	`consented_at` integer NOT NULL,
	`confirmed_at` integer,
	`unsubscribed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_email_list_uq` ON `newsletter_subscribers` (`email`,`list`);--> statement-breakpoint
CREATE INDEX `newsletter_status_idx` ON `newsletter_subscribers` (`status`);--> statement-breakpoint
CREATE TABLE `saved_articles` (
	`user_id` text NOT NULL,
	`article_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `article_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `saved_articles_article_idx` ON `saved_articles` (`article_id`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`domain` text NOT NULL,
	`publisher` text NOT NULL,
	`source_type` text NOT NULL,
	`country` text DEFAULT 'US' NOT NULL,
	`ownership` text,
	`credibility_tier` integer NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`citation_requirements` text,
	`licensing_status` text DEFAULT 'review_required' NOT NULL,
	`reliability_notes` text,
	`last_reviewed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sources_domain_uq` ON `sources` (`domain`);--> statement-breakpoint
CREATE INDEX `sources_tier_idx` ON `sources` (`credibility_tier`);--> statement-breakpoint
CREATE TABLE `state_transitions` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`from_state` text,
	`to_state` text NOT NULL,
	`actor_id` text,
	`reason` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`occurred_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `state_transitions_entity_idx` ON `state_transitions` (`entity_type`,`entity_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `story_clusters` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'developing' NOT NULL,
	`plain_summary` text,
	`latest_confirmed_development` text,
	`latest_update_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `story_clusters_slug_uq` ON `story_clusters` (`slug`);--> statement-breakpoint
CREATE INDEX `story_clusters_category_status_idx` ON `story_clusters` (`category`,`status`);--> statement-breakpoint
CREATE TABLE `trends` (
	`id` text PRIMARY KEY NOT NULL,
	`original_term` text NOT NULL,
	`normalized_term` text NOT NULL,
	`related_terms_json` text DEFAULT '[]' NOT NULL,
	`category` text NOT NULL,
	`entities_json` text DEFAULT '[]' NOT NULL,
	`geographic_market` text DEFAULT 'US' NOT NULL,
	`first_detected_at` integer NOT NULL,
	`latest_detected_at` integer NOT NULL,
	`search_velocity` integer DEFAULT 0 NOT NULL,
	`source_velocity` integer DEFAULT 0 NOT NULL,
	`social_velocity` integer DEFAULT 0 NOT NULL,
	`us_relevance` integer DEFAULT 0 NOT NULL,
	`commercial_value` integer DEFAULT 0 NOT NULL,
	`novelty` integer DEFAULT 0 NOT NULL,
	`visual_availability` integer DEFAULT 0 NOT NULL,
	`primary_source_availability` integer DEFAULT 0 NOT NULL,
	`risk_level` text DEFAULT 'LOW' NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`score_explanation_json` text DEFAULT '{}' NOT NULL,
	`editorial_state` text DEFAULT 'SIGNAL_DETECTED' NOT NULL,
	`story_cluster_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`story_cluster_id`) REFERENCES `story_clusters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `trends_market_score_idx` ON `trends` (`geographic_market`,`score`);--> statement-breakpoint
CREATE INDEX `trends_normalized_term_idx` ON `trends` (`normalized_term`);--> statement-breakpoint
CREATE INDEX `trends_state_idx` ON `trends` (`editorial_state`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`role` text DEFAULT 'Writer' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_uq` ON `users` (`email`);