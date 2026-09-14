CREATE TABLE `newsletter_rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`key_hash` text NOT NULL,
	`window_started_at` integer NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_rate_limit_window_uq` ON `newsletter_rate_limits` (`scope`,`key_hash`,`window_started_at`);--> statement-breakpoint
CREATE INDEX `newsletter_rate_limit_expiry_idx` ON `newsletter_rate_limits` (`expires_at`);--> statement-breakpoint
ALTER TABLE `newsletter_subscribers` ADD `confirmation_token_expires_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_confirmation_token_uq` ON `newsletter_subscribers` (`confirmation_token_hash`);