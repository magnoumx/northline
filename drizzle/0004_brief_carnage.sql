CREATE TABLE `ad_clicks` (
	`id` text PRIMARY KEY NOT NULL,
	`impression_id` text NOT NULL,
	`token_nonce_hash` text NOT NULL,
	`destination_url_normalized` text NOT NULL,
	`validation_state` text DEFAULT 'RAW' NOT NULL,
	`billable` integer DEFAULT false NOT NULL,
	`occurred_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`impression_id`) REFERENCES `ad_impressions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ad_clicks_nonce_uq` ON `ad_clicks` (`token_nonce_hash`);--> statement-breakpoint
CREATE INDEX `ad_clicks_impression_time_idx` ON `ad_clicks` (`impression_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `ad_impressions` (
	`id` text PRIMARY KEY NOT NULL,
	`ad_request_id` text NOT NULL,
	`token_nonce_hash` text NOT NULL,
	`line_item_id` text NOT NULL,
	`creative_version_id` text NOT NULL,
	`validation_state` text DEFAULT 'RAW' NOT NULL,
	`billable` integer DEFAULT false NOT NULL,
	`occurred_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`ad_request_id`) REFERENCES `ad_requests`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`line_item_id`) REFERENCES `line_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creative_version_id`) REFERENCES `creative_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ad_impressions_request_uq` ON `ad_impressions` (`ad_request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ad_impressions_nonce_uq` ON `ad_impressions` (`token_nonce_hash`);--> statement-breakpoint
CREATE INDEX `ad_impressions_line_item_time_idx` ON `ad_impressions` (`line_item_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `ad_kill_switches` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`reason` text NOT NULL,
	`activated_by_id` text NOT NULL,
	`activated_at` integer NOT NULL,
	`released_by_id` text,
	`released_at` integer,
	FOREIGN KEY (`activated_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`released_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ad_kill_switches_scope_uq` ON `ad_kill_switches` (`scope_type`,`scope_id`);--> statement-breakpoint
CREATE TABLE `ad_placements` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`supported_dimensions_json` text NOT NULL,
	`mobile_behavior` text NOT NULL,
	`allowed_creative_types_json` text NOT NULL,
	`maximum_file_bytes` integer NOT NULL,
	`performance_budget_json` text DEFAULT '{}' NOT NULL,
	`sensitive_content_policy` text NOT NULL,
	`maximum_density` integer DEFAULT 1 NOT NULL,
	`viewability_expectation` integer DEFAULT 50 NOT NULL,
	`fallback_behavior` text DEFAULT 'COLLAPSE' NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`killed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "ad_placements_file_size_ck" CHECK("ad_placements"."maximum_file_bytes" > 0),
	CONSTRAINT "ad_placements_viewability_ck" CHECK("ad_placements"."viewability_expectation" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ad_placements_code_uq` ON `ad_placements` (`code`);--> statement-breakpoint
CREATE TABLE `ad_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`placement_id` text NOT NULL,
	`line_item_id` text,
	`creative_version_id` text,
	`anonymous_viewer_hash` text,
	`client_ip_hash` text,
	`page_class` text NOT NULL,
	`country` text DEFAULT 'UNKNOWN' NOT NULL,
	`device` text DEFAULT 'UNKNOWN' NOT NULL,
	`selection_reason` text NOT NULL,
	`is_internal` integer DEFAULT false NOT NULL,
	`is_crawler` integer DEFAULT false NOT NULL,
	`occurred_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`placement_id`) REFERENCES `ad_placements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`line_item_id`) REFERENCES `line_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creative_version_id`) REFERENCES `creative_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ad_requests_placement_time_idx` ON `ad_requests` (`placement_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `ad_requests_line_item_time_idx` ON `ad_requests` (`line_item_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `ad_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`placement_id` text NOT NULL,
	`page_pattern` text NOT NULL,
	`ordinal` integer DEFAULT 1 NOT NULL,
	`minimum_publisher_content_chars` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`placement_id`) REFERENCES `ad_placements`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ad_slots_placement_page_ordinal_uq` ON `ad_slots` (`placement_id`,`page_pattern`,`ordinal`);--> statement-breakpoint
CREATE TABLE `advertiser_members` (
	`advertiser_organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'VIEWER' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`advertiser_organization_id`, `user_id`),
	FOREIGN KEY (`advertiser_organization_id`) REFERENCES `advertiser_organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `advertiser_members_user_idx` ON `advertiser_members` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `advertiser_organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`advertiser_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`external_reference` text,
	`billing_contact_json` text DEFAULT '{}' NOT NULL,
	`tax_metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`advertiser_id`) REFERENCES `advertisers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `advertiser_organizations_org_uq` ON `advertiser_organizations` (`organization_id`);--> statement-breakpoint
CREATE INDEX `advertiser_organizations_advertiser_idx` ON `advertiser_organizations` (`advertiser_id`);--> statement-breakpoint
CREATE TABLE `advertisers` (
	`id` text PRIMARY KEY NOT NULL,
	`legal_name` text NOT NULL,
	`display_name` text NOT NULL,
	`website_url` text NOT NULL,
	`status` text DEFAULT 'PROSPECT' NOT NULL,
	`industry` text,
	`billing_email` text,
	`risk_level` text DEFAULT 'UNREVIEWED' NOT NULL,
	`disabled_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `advertisers_status_idx` ON `advertisers` (`status`);--> statement-breakpoint
CREATE INDEX `advertisers_website_idx` ON `advertisers` (`website_url`);--> statement-breakpoint
CREATE TABLE `advertising_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`email_hash` text NOT NULL,
	`full_name` text NOT NULL,
	`work_email` text NOT NULL,
	`company` text NOT NULL,
	`company_website` text NOT NULL,
	`campaign_objective` text NOT NULL,
	`product_or_service` text NOT NULL,
	`target_audience` text NOT NULL,
	`target_countries_json` text DEFAULT '[]' NOT NULL,
	`preferred_categories_json` text DEFAULT '[]' NOT NULL,
	`preferred_placements_json` text DEFAULT '[]' NOT NULL,
	`estimated_budget_cents` integer,
	`desired_start_at` integer,
	`desired_end_at` integer,
	`creative_status` text NOT NULL,
	`sponsored_content_interest` integer DEFAULT false NOT NULL,
	`newsletter_sponsorship_interest` integer DEFAULT false NOT NULL,
	`message` text,
	`consented_at` integer NOT NULL,
	`status` text DEFAULT 'NEW' NOT NULL,
	`duplicate_of_id` text,
	`assigned_to_id` text,
	`next_follow_up_at` integer,
	`spam_score` integer DEFAULT 0 NOT NULL,
	`source_ip_hash` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`assigned_to_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "advertising_leads_status_ck" CHECK("advertising_leads"."status" IN ('NEW','QUALIFYING','CONTACTED','PROPOSAL_SENT','NEGOTIATING','WON','LOST','SPAM','ARCHIVED')),
	CONSTRAINT "advertising_leads_dates_ck" CHECK("advertising_leads"."desired_end_at" IS NULL OR "advertising_leads"."desired_start_at" IS NULL OR "advertising_leads"."desired_end_at" >= "advertising_leads"."desired_start_at")
);
--> statement-breakpoint
CREATE INDEX `advertising_leads_status_followup_idx` ON `advertising_leads` (`status`,`next_follow_up_at`);--> statement-breakpoint
CREATE INDEX `advertising_leads_email_created_idx` ON `advertising_leads` (`email_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `affiliate_links` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text,
	`merchant` text NOT NULL,
	`network` text NOT NULL,
	`campaign_reference` text,
	`destination_url_normalized` text NOT NULL,
	`disclosure` text NOT NULL,
	`starts_at` integer,
	`expires_at` integer,
	`last_health_check_at` integer,
	`status` text DEFAULT 'DISABLED' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `affiliate_links_article_status_idx` ON `affiliate_links` (`article_id`,`status`);--> statement-breakpoint
CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`stream` text NOT NULL,
	`anonymous_id_hash` text,
	`user_id` text,
	`article_id` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`occurred_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "analytics_events_stream_ck" CHECK("analytics_events"."stream" IN ('READER', 'EDITORIAL', 'ADVERTISING', 'SECURITY', 'OPERATIONAL'))
);
--> statement-breakpoint
CREATE INDEX `analytics_events_stream_time_idx` ON `analytics_events` (`stream`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `analytics_events_article_time_idx` ON `analytics_events` (`article_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `auth_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`password_hash` text,
	`email_verified_at` integer,
	`disabled_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_accounts_provider_account_uq` ON `auth_accounts` (`provider`,`provider_account_id`);--> statement-breakpoint
CREATE INDEX `auth_accounts_user_idx` ON `auth_accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_recovery_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_recovery_codes_hash_uq` ON `auth_recovery_codes` (`code_hash`);--> statement-breakpoint
CREATE INDEX `auth_recovery_codes_user_idx` ON `auth_recovery_codes` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_security_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`failed_login_count` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`mfa_method` text,
	`mfa_secret_encrypted` text,
	`mfa_enabled_at` integer,
	`last_password_change_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "auth_security_profiles_failed_count_ck" CHECK("auth_security_profiles"."failed_login_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`rotation_family_hash` text NOT NULL,
	`user_agent_hash` text,
	`client_ip_hash` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_seen_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`rotated_at` integer,
	`revoked_at` integer,
	`revocation_reason` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessions_token_uq` ON `auth_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `auth_sessions_user_expiry_idx` ON `auth_sessions` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `auth_sessions_family_idx` ON `auth_sessions` (`rotation_family_hash`);--> statement-breakpoint
CREATE TABLE `campaign_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`total_cents` integer NOT NULL,
	`daily_cents` integer,
	`committed_cents` integer DEFAULT 0 NOT NULL,
	`spent_cents` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "campaign_budgets_amounts_ck" CHECK("campaign_budgets"."total_cents" >= 0 AND ("campaign_budgets"."daily_cents" IS NULL OR "campaign_budgets"."daily_cents" >= 0) AND "campaign_budgets"."committed_cents" >= 0 AND "campaign_budgets"."spent_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_budgets_campaign_uq` ON `campaign_budgets` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `campaign_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`line_item_id` text NOT NULL,
	`bucket_date` text NOT NULL,
	`placement_id` text NOT NULL,
	`country` text DEFAULT 'UNKNOWN' NOT NULL,
	`device` text DEFAULT 'UNKNOWN' NOT NULL,
	`creative_id` text,
	`requested` integer DEFAULT 0 NOT NULL,
	`served` integer DEFAULT 0 NOT NULL,
	`viewable` integer DEFAULT 0 NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	`invalid_events` integer DEFAULT 0 NOT NULL,
	`billable_units` integer DEFAULT 0 NOT NULL,
	`spend_cents` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`line_item_id`) REFERENCES `line_items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`placement_id`) REFERENCES `ad_placements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creative_id`) REFERENCES `creatives`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "campaign_deliveries_counts_ck" CHECK("campaign_deliveries"."requested" >= 0 AND "campaign_deliveries"."served" >= 0 AND "campaign_deliveries"."viewable" >= 0 AND "campaign_deliveries"."clicks" >= 0 AND "campaign_deliveries"."invalid_events" >= 0 AND "campaign_deliveries"."billable_units" >= 0 AND "campaign_deliveries"."spend_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_deliveries_bucket_uq` ON `campaign_deliveries` (`line_item_id`,`bucket_date`,`placement_id`,`country`,`device`,`creative_id`);--> statement-breakpoint
CREATE TABLE `campaign_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`order_number` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`signed_at` integer,
	`signed_by_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`signed_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "campaign_orders_total_ck" CHECK("campaign_orders"."total_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_orders_number_uq` ON `campaign_orders` (`order_number`);--> statement-breakpoint
CREATE INDEX `campaign_orders_campaign_idx` ON `campaign_orders` (`campaign_id`,`status`);--> statement-breakpoint
CREATE TABLE `campaign_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`report_type` text NOT NULL,
	`window_starts_at` integer NOT NULL,
	`window_ends_at` integer NOT NULL,
	`raw_events` integer DEFAULT 0 NOT NULL,
	`validated_events` integer DEFAULT 0 NOT NULL,
	`billable_events` integer DEFAULT 0 NOT NULL,
	`estimates_json` text DEFAULT '{}' NOT NULL,
	`breakdown_json` text DEFAULT '{}' NOT NULL,
	`generated_at` integer NOT NULL,
	`generated_by_id` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`generated_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "campaign_reports_counts_ck" CHECK("campaign_reports"."raw_events" >= 0 AND "campaign_reports"."validated_events" >= 0 AND "campaign_reports"."billable_events" >= 0)
);
--> statement-breakpoint
CREATE INDEX `campaign_reports_campaign_window_idx` ON `campaign_reports` (`campaign_id`,`window_starts_at`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`advertiser_organization_id` text NOT NULL,
	`name` text NOT NULL,
	`objective` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`terms_accepted_at` integer,
	`terms_accepted_by_id` text,
	`approved_at` integer,
	`approved_by_id` text,
	`killed_at` integer,
	`created_by_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`advertiser_organization_id`) REFERENCES `advertiser_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`terms_accepted_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "campaigns_dates_ck" CHECK("campaigns"."ends_at" IS NULL OR "campaigns"."starts_at" IS NULL OR "campaigns"."ends_at" >= "campaigns"."starts_at")
);
--> statement-breakpoint
CREATE INDEX `campaigns_org_status_idx` ON `campaigns` (`advertiser_organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `campaigns_schedule_idx` ON `campaigns` (`starts_at`,`ends_at`);--> statement-breakpoint
CREATE TABLE `commercial_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`advertiser_organization_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`decision` text NOT NULL,
	`reason` text NOT NULL,
	`before_hash` text,
	`after_hash` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`ip_hash` text,
	`occurred_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`advertiser_organization_id`) REFERENCES `advertiser_organizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `commercial_audit_target_idx` ON `commercial_audit_logs` (`target_type`,`target_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `commercial_audit_org_idx` ON `commercial_audit_logs` (`advertiser_organization_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `conversion_events` (
	`id` text PRIMARY KEY NOT NULL,
	`click_id` text,
	`advertiser_organization_id` text NOT NULL,
	`external_event_hash` text NOT NULL,
	`conversion_type` text NOT NULL,
	`value_cents` integer,
	`currency` text,
	`validated` integer DEFAULT false NOT NULL,
	`occurred_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`click_id`) REFERENCES `ad_clicks`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`advertiser_organization_id`) REFERENCES `advertiser_organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversion_events_external_uq` ON `conversion_events` (`advertiser_organization_id`,`external_event_hash`);--> statement-breakpoint
CREATE TABLE `creative_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`creative_version_id` text NOT NULL,
	`decision` text NOT NULL,
	`policy_categories_json` text DEFAULT '[]' NOT NULL,
	`destination_checked_at` integer,
	`reviewer_id` text NOT NULL,
	`reason` text NOT NULL,
	`occurred_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`creative_version_id`) REFERENCES `creative_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "creative_approvals_decision_ck" CHECK("creative_approvals"."decision" IN ('APPROVED','REJECTED','CHANGES_REQUIRED','REVOKED'))
);
--> statement-breakpoint
CREATE INDEX `creative_approvals_version_time_idx` ON `creative_approvals` (`creative_version_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `creative_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`creative_id` text NOT NULL,
	`version` integer NOT NULL,
	`content_hash` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`storage_key` text,
	`sanitized_markup` text,
	`native_payload_json` text,
	`scan_status` text DEFAULT 'QUARANTINED' NOT NULL,
	`metadata_stripped` integer DEFAULT false NOT NULL,
	`created_by_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`creative_id`) REFERENCES `creatives`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "creative_versions_size_ck" CHECK("creative_versions"."byte_size" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creative_versions_version_uq` ON `creative_versions` (`creative_id`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `creative_versions_hash_uq` ON `creative_versions` (`content_hash`);--> statement-breakpoint
CREATE TABLE `creatives` (
	`id` text PRIMARY KEY NOT NULL,
	`advertiser_organization_id` text NOT NULL,
	`name` text NOT NULL,
	`creative_type` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`destination_url_normalized` text NOT NULL,
	`destination_host` text NOT NULL,
	`killed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`advertiser_organization_id`) REFERENCES `advertiser_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "creatives_type_ck" CHECK("creatives"."creative_type" IN ('IMAGE','HTML_SANITIZED','NATIVE_CARD','VIDEO_VAST_FROM_APPROVED_PROVIDER'))
);
--> statement-breakpoint
CREATE INDEX `creatives_org_status_idx` ON `creatives` (`advertiser_organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `credits` (
	`id` text PRIMARY KEY NOT NULL,
	`advertiser_organization_id` text NOT NULL,
	`invoice_id` text,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`reason` text NOT NULL,
	`remaining_cents` integer NOT NULL,
	`approved_by_id` text NOT NULL,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`advertiser_organization_id`) REFERENCES `advertiser_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "credits_amount_ck" CHECK("credits"."amount_cents" > 0 AND "credits"."remaining_cents" >= 0 AND "credits"."remaining_cents" <= "credits"."amount_cents")
);
--> statement-breakpoint
CREATE TABLE `frequency_caps` (
	`id` text PRIMARY KEY NOT NULL,
	`advertiser_organization_id` text NOT NULL,
	`scope` text DEFAULT 'LINE_ITEM' NOT NULL,
	`maximum_views` integer NOT NULL,
	`window_seconds` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`advertiser_organization_id`) REFERENCES `advertiser_organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "frequency_caps_positive_ck" CHECK("frequency_caps"."maximum_views" > 0 AND "frequency_caps"."window_seconds" > 0)
);
--> statement-breakpoint
CREATE TABLE `invalid_traffic_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`event_id` text NOT NULL,
	`reason_code` text NOT NULL,
	`risk_score` integer NOT NULL,
	`detector` text NOT NULL,
	`evidence_json` text DEFAULT '{}' NOT NULL,
	`reviewed_by_id` text,
	`occurred_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "invalid_traffic_risk_ck" CHECK("invalid_traffic_events"."risk_score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invalid_traffic_event_uq` ON `invalid_traffic_events` (`event_type`,`event_id`,`reason_code`);--> statement-breakpoint
CREATE TABLE `inventory_forecasts` (
	`id` text PRIMARY KEY NOT NULL,
	`placement_id` text NOT NULL,
	`window_starts_at` integer NOT NULL,
	`window_ends_at` integer NOT NULL,
	`estimated_low` integer NOT NULL,
	`estimated_high` integer NOT NULL,
	`reserved_impressions` integer DEFAULT 0 NOT NULL,
	`confidence` text NOT NULL,
	`assumptions_json` text DEFAULT '[]' NOT NULL,
	`generated_at` integer NOT NULL,
	FOREIGN KEY (`placement_id`) REFERENCES `ad_placements`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "inventory_forecasts_range_ck" CHECK("inventory_forecasts"."estimated_low" >= 0 AND "inventory_forecasts"."estimated_high" >= "inventory_forecasts"."estimated_low" AND "inventory_forecasts"."reserved_impressions" >= 0)
);
--> statement-breakpoint
CREATE INDEX `inventory_forecasts_placement_window_idx` ON `inventory_forecasts` (`placement_id`,`window_starts_at`,`window_ends_at`);--> statement-breakpoint
CREATE TABLE `invoice_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`line_item_id` text,
	`description` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`evidence_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`line_item_id`) REFERENCES `line_items`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "invoice_lines_amounts_ck" CHECK("invoice_lines"."quantity" >= 0 AND "invoice_lines"."unit_price_cents" >= 0 AND "invoice_lines"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE INDEX `invoice_lines_invoice_idx` ON `invoice_lines` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`advertiser_organization_id` text NOT NULL,
	`campaign_id` text,
	`invoice_number` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`subtotal_cents` integer DEFAULT 0 NOT NULL,
	`tax_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`amount_paid_cents` integer DEFAULT 0 NOT NULL,
	`due_at` integer,
	`sent_at` integer,
	`paid_at` integer,
	`immutable_at` integer,
	`provider` text DEFAULT 'MANUAL' NOT NULL,
	`provider_reference` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`advertiser_organization_id`) REFERENCES `advertiser_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "invoices_status_ck" CHECK("invoices"."status" IN ('DRAFT','SENT','PAID','PARTIALLY_PAID','PAYMENT_FAILED','REFUNDED','CREDITED','OVERDUE','CANCELLED')),
	CONSTRAINT "invoices_amounts_ck" CHECK("invoices"."subtotal_cents" >= 0 AND "invoices"."tax_cents" >= 0 AND "invoices"."total_cents" >= 0 AND "invoices"."amount_paid_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_number_uq` ON `invoices` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `invoices_org_status_idx` ON `invoices` (`advertiser_organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `line_item_creatives` (
	`line_item_id` text NOT NULL,
	`creative_id` text NOT NULL,
	`weight` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`line_item_id`, `creative_id`),
	FOREIGN KEY (`line_item_id`) REFERENCES `line_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`creative_id`) REFERENCES `creatives`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "line_item_creatives_weight_ck" CHECK("line_item_creatives"."weight" > 0)
);
--> statement-breakpoint
CREATE TABLE `line_items` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`campaign_order_id` text,
	`placement_id` text NOT NULL,
	`targeting_rule_id` text,
	`frequency_cap_id` text,
	`name` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`time_zone` text DEFAULT 'America/New_York' NOT NULL,
	`pricing_model` text NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`contracted_impressions` integer,
	`contracted_clicks` integer,
	`daily_budget_cents` integer,
	`total_budget_cents` integer NOT NULL,
	`pacing` text DEFAULT 'EVEN' NOT NULL,
	`priority` integer DEFAULT 5 NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`approved_at` integer,
	`approved_by_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`campaign_order_id`) REFERENCES `campaign_orders`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`placement_id`) REFERENCES `ad_placements`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`targeting_rule_id`) REFERENCES `targeting_rules`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`frequency_cap_id`) REFERENCES `frequency_caps`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "line_items_status_ck" CHECK("line_items"."status" IN ('DRAFT','PENDING_REVIEW','CHANGES_REQUIRED','APPROVED','READY','DELIVERING','PAUSED','COMPLETED','UNDERDELIVERED','CANCELLED','REJECTED')),
	CONSTRAINT "line_items_model_ck" CHECK("line_items"."pricing_model" IN ('FLAT_FEE','CPD','CPM','VIEWABLE_CPM','CPC','SPONSORSHIP_SHARE','NEWSLETTER_FLAT_FEE','SPONSORED_CONTENT_FEE')),
	CONSTRAINT "line_items_values_ck" CHECK("line_items"."ends_at" >= "line_items"."starts_at" AND "line_items"."unit_price_cents" >= 0 AND "line_items"."total_budget_cents" >= 0 AND "line_items"."priority" BETWEEN 1 AND 10)
);
--> statement-breakpoint
CREATE INDEX `line_items_campaign_status_idx` ON `line_items` (`campaign_id`,`status`);--> statement-breakpoint
CREATE INDEX `line_items_delivery_window_idx` ON `line_items` (`placement_id`,`status`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE TABLE `make_goods` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`line_item_id` text,
	`reason` text NOT NULL,
	`owed_units` integer NOT NULL,
	`delivered_units` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`approved_by_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`line_item_id`) REFERENCES `line_items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "make_goods_units_ck" CHECK("make_goods"."owed_units" > 0 AND "make_goods"."delivered_units" >= 0)
);
--> statement-breakpoint
CREATE TABLE `membership_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`price_cents` integer NOT NULL,
	`billing_interval` text NOT NULL,
	`entitlements_json` text DEFAULT '[]' NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "membership_plans_price_ck" CHECK("membership_plans"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_plans_key_uq` ON `membership_plans` (`key`);--> statement-breakpoint
CREATE TABLE `newsletter_sponsorships` (
	`id` text PRIMARY KEY NOT NULL,
	`sponsorship_id` text NOT NULL,
	`list_key` text NOT NULL,
	`issue_date` text NOT NULL,
	`placement` text NOT NULL,
	`preview_approved_at` integer,
	`status` text DEFAULT 'HELD' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`sponsorship_id`) REFERENCES `sponsorships`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_sponsorship_slot_uq` ON `newsletter_sponsorships` (`list_key`,`issue_date`,`placement`);--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`notification_type` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`quiet_hours_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_preferences_uq` ON `notification_preferences` (`user_id`,`channel`,`notification_type`);--> statement-breakpoint
CREATE TABLE `organization_members` (
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`invited_by_id` text,
	`joined_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`organization_id`, `user_id`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `organization_members_user_idx` ON `organization_members` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'ADVERTISER' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_uq` ON `organizations` (`slug`);--> statement-breakpoint
CREATE INDEX `organizations_kind_status_idx` ON `organizations` (`kind`,`status`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_reference` text NOT NULL,
	`status` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`received_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "payments_amount_ck" CHECK("payments"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_provider_reference_uq` ON `payments` (`provider`,`provider_reference`);--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`description` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `permissions_key_uq` ON `permissions` (`key`);--> statement-breakpoint
CREATE TABLE `pricing_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`placement_id` text,
	`pricing_model` text NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`minimum_spend_cents` integer DEFAULT 0 NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`enabled` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`placement_id`) REFERENCES `ad_placements`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "pricing_rules_model_ck" CHECK("pricing_rules"."pricing_model" IN ('FLAT_FEE','CPD','CPM','VIEWABLE_CPM','CPC','SPONSORSHIP_SHARE','NEWSLETTER_FLAT_FEE','SPONSORED_CONTENT_FEE')),
	CONSTRAINT "pricing_rules_amount_ck" CHECK("pricing_rules"."unit_price_cents" >= 0 AND "pricing_rules"."minimum_spend_cents" >= 0)
);
--> statement-breakpoint
CREATE INDEX `pricing_rules_placement_model_idx` ON `pricing_rules` (`placement_id`,`pricing_model`);--> statement-breakpoint
CREATE TABLE `reader_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`preference_type` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`value_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reader_preferences_target_uq` ON `reader_preferences` (`user_id`,`preference_type`,`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `reader_preferences_user_type_idx` ON `reader_preferences` (`user_id`,`preference_type`);--> statement-breakpoint
CREATE TABLE `reader_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`time_zone` text DEFAULT 'America/New_York' NOT NULL,
	`theme` text DEFAULT 'SYSTEM' NOT NULL,
	`text_scale` integer DEFAULT 100 NOT NULL,
	`personalization_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reader_profiles_text_scale_ck" CHECK("reader_profiles"."text_scale" BETWEEN 80 AND 140)
);
--> statement-breakpoint
CREATE TABLE `reading_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`article_id` text NOT NULL,
	`first_viewed_at` integer NOT NULL,
	`last_viewed_at` integer NOT NULL,
	`completion_percent` integer DEFAULT 0 NOT NULL,
	`view_count` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reading_history_completion_ck" CHECK("reading_history"."completion_percent" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reading_history_user_article_uq` ON `reading_history` (`user_id`,`article_id`);--> statement-breakpoint
CREATE INDEX `reading_history_recent_idx` ON `reading_history` (`user_id`,`last_viewed_at`);--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`provider_reference` text,
	`approved_by_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "refunds_amount_ck" CHECK("refunds"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE INDEX `refunds_payment_idx` ON `refunds` (`payment_id`);--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` text NOT NULL,
	`permission_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`role_id`, `permission_id`),
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `role_permissions_permission_idx` ON `role_permissions` (`permission_id`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`scope` text DEFAULT 'STAFF' NOT NULL,
	`description` text,
	`is_system` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "roles_scope_ck" CHECK("roles"."scope" IN ('STAFF', 'ADVERTISER', 'GLOBAL'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_key_uq` ON `roles` (`key`);--> statement-breakpoint
CREATE TABLE `sales_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`advertiser_id` text NOT NULL,
	`full_name` text NOT NULL,
	`email` text NOT NULL,
	`title` text,
	`phone` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`advertiser_id`) REFERENCES `advertisers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_contacts_advertiser_email_uq` ON `sales_contacts` (`advertiser_id`,`email`);--> statement-breakpoint
CREATE TABLE `sponsored_content_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`sponsorship_id` text NOT NULL,
	`article_id` text,
	`title` text NOT NULL,
	`status` text DEFAULT 'BRIEF' NOT NULL,
	`commercial_author_id` text,
	`reviewer_id` text,
	`claims_reviewed_at` integer,
	`media_rights_reviewed_at` integer,
	`disclosure_approved_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`sponsorship_id`) REFERENCES `sponsorships`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`commercial_author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sponsored_content_article_uq` ON `sponsored_content_projects` (`article_id`);--> statement-breakpoint
CREATE INDEX `sponsored_content_status_idx` ON `sponsored_content_projects` (`status`);--> statement-breakpoint
CREATE TABLE `sponsors` (
	`id` text PRIMARY KEY NOT NULL,
	`advertiser_organization_id` text NOT NULL,
	`display_name` text NOT NULL,
	`disclosure_text` text NOT NULL,
	`logo_storage_key` text,
	`approved_at` integer,
	`approved_by_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`advertiser_organization_id`) REFERENCES `advertiser_organizations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sponsors_advertiser_org_idx` ON `sponsors` (`advertiser_organization_id`);--> statement-breakpoint
CREATE TABLE `sponsorships` (
	`id` text PRIMARY KEY NOT NULL,
	`sponsor_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`sponsorship_type` text NOT NULL,
	`target_reference` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`sponsor_id`) REFERENCES `sponsors`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "sponsorships_dates_ck" CHECK("sponsorships"."ends_at" >= "sponsorships"."starts_at")
);
--> statement-breakpoint
CREATE INDEX `sponsorships_target_window_idx` ON `sponsorships` (`sponsorship_type`,`target_reference`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE TABLE `targeting_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`advertiser_organization_id` text NOT NULL,
	`name` text NOT NULL,
	`countries_json` text DEFAULT '[]' NOT NULL,
	`devices_json` text DEFAULT '[]' NOT NULL,
	`categories_json` text DEFAULT '[]' NOT NULL,
	`excluded_pages_json` text DEFAULT '[]' NOT NULL,
	`excluded_sensitive_content` integer DEFAULT true NOT NULL,
	`sensitive_traits_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`advertiser_organization_id`) REFERENCES `advertiser_organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `targeting_rules_org_idx` ON `targeting_rules` (`advertiser_organization_id`);--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`organization_id` text,
	`granted_by_id` text,
	`granted_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_roles_scope_uq` ON `user_roles` (`user_id`,`role_id`,`organization_id`);--> statement-breakpoint
CREATE INDEX `user_roles_org_idx` ON `user_roles` (`organization_id`,`role_id`);--> statement-breakpoint
CREATE TABLE `viewable_impressions` (
	`id` text PRIMARY KEY NOT NULL,
	`impression_id` text NOT NULL,
	`token_nonce_hash` text NOT NULL,
	`visible_percent` integer NOT NULL,
	`visible_milliseconds` integer NOT NULL,
	`validated` integer DEFAULT false NOT NULL,
	`occurred_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`impression_id`) REFERENCES `ad_impressions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "viewable_impressions_values_ck" CHECK("viewable_impressions"."visible_percent" BETWEEN 0 AND 100 AND "viewable_impressions"."visible_milliseconds" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `viewable_impressions_impression_uq` ON `viewable_impressions` (`impression_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `viewable_impressions_nonce_uq` ON `viewable_impressions` (`token_nonce_hash`);--> statement-breakpoint
CREATE TRIGGER `commercial_audit_logs_no_update`
BEFORE UPDATE ON `commercial_audit_logs`
BEGIN
  SELECT RAISE(ABORT, 'commercial audit logs are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `commercial_audit_logs_no_delete`
BEFORE DELETE ON `commercial_audit_logs`
BEGIN
  SELECT RAISE(ABORT, 'commercial audit logs are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `creative_versions_no_update`
BEFORE UPDATE ON `creative_versions`
BEGIN
  SELECT RAISE(ABORT, 'creative versions are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `creative_versions_no_delete`
BEFORE DELETE ON `creative_versions`
BEGIN
  SELECT RAISE(ABORT, 'creative versions are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `creative_approvals_no_update`
BEFORE UPDATE ON `creative_approvals`
BEGIN
  SELECT RAISE(ABORT, 'creative approvals are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `creative_approvals_no_delete`
BEFORE DELETE ON `creative_approvals`
BEGIN
  SELECT RAISE(ABORT, 'creative approvals are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `ad_requests_no_update`
BEFORE UPDATE ON `ad_requests`
BEGIN
  SELECT RAISE(ABORT, 'ad requests are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `ad_requests_no_delete`
BEFORE DELETE ON `ad_requests`
BEGIN
  SELECT RAISE(ABORT, 'ad requests are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `ad_impressions_no_update`
BEFORE UPDATE ON `ad_impressions`
BEGIN
  SELECT RAISE(ABORT, 'ad impressions are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `ad_impressions_no_delete`
BEFORE DELETE ON `ad_impressions`
BEGIN
  SELECT RAISE(ABORT, 'ad impressions are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `viewable_impressions_no_update`
BEFORE UPDATE ON `viewable_impressions`
BEGIN
  SELECT RAISE(ABORT, 'viewability events are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `viewable_impressions_no_delete`
BEFORE DELETE ON `viewable_impressions`
BEGIN
  SELECT RAISE(ABORT, 'viewability events are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `ad_clicks_no_update`
BEFORE UPDATE ON `ad_clicks`
BEGIN
  SELECT RAISE(ABORT, 'ad clicks are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `ad_clicks_no_delete`
BEFORE DELETE ON `ad_clicks`
BEGIN
  SELECT RAISE(ABORT, 'ad clicks are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `invalid_traffic_events_no_update`
BEFORE UPDATE ON `invalid_traffic_events`
BEGIN
  SELECT RAISE(ABORT, 'invalid traffic decisions are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `invalid_traffic_events_no_delete`
BEFORE DELETE ON `invalid_traffic_events`
BEGIN
  SELECT RAISE(ABORT, 'invalid traffic decisions are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `campaign_reports_no_update`
BEFORE UPDATE ON `campaign_reports`
BEGIN
  SELECT RAISE(ABORT, 'campaign reports are immutable snapshots');
END;--> statement-breakpoint
CREATE TRIGGER `campaign_reports_no_delete`
BEFORE DELETE ON `campaign_reports`
BEGIN
  SELECT RAISE(ABORT, 'campaign reports are immutable snapshots');
END;--> statement-breakpoint
CREATE TRIGGER `invoices_locked_financial_fields`
BEFORE UPDATE OF `advertiser_organization_id`, `campaign_id`, `currency`,
  `subtotal_cents`, `tax_cents`, `total_cents`
ON `invoices`
WHEN OLD.`immutable_at` IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'issued invoice financial fields are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `invoices_no_delete_after_issue`
BEFORE DELETE ON `invoices`
WHEN OLD.`immutable_at` IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'issued invoices cannot be deleted');
END;--> statement-breakpoint
CREATE TRIGGER `campaigns_delivery_requires_approval`
BEFORE UPDATE OF `status` ON `campaigns`
WHEN NEW.`status` IN ('READY', 'DELIVERING', 'COMPLETED')
  AND (
    NEW.`approved_at` IS NULL
    OR NEW.`approved_by_id` IS NULL
    OR NEW.`terms_accepted_at` IS NULL
    OR NEW.`terms_accepted_by_id` IS NULL
  )
BEGIN
  SELECT RAISE(ABORT, 'campaign delivery requires approved terms');
END;--> statement-breakpoint
CREATE TRIGGER `line_items_delivery_requires_approved_creative`
BEFORE UPDATE OF `status` ON `line_items`
WHEN NEW.`status` IN ('READY', 'DELIVERING')
  AND (
    NEW.`approved_at` IS NULL
    OR NEW.`approved_by_id` IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM `line_item_creatives` lic
      JOIN `creative_versions` cv ON cv.`creative_id` = lic.`creative_id`
      JOIN `creative_approvals` ca ON ca.`creative_version_id` = cv.`id`
      WHERE lic.`line_item_id` = NEW.`id`
        AND ca.`decision` = 'APPROVED'
        AND NOT EXISTS (
          SELECT 1
          FROM `creative_approvals` later
          WHERE later.`creative_version_id` = ca.`creative_version_id`
            AND later.`occurred_at` > ca.`occurred_at`
            AND later.`decision` IN ('REVOKED', 'REJECTED', 'CHANGES_REQUIRED')
        )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'line item delivery requires an approved creative');
END;
