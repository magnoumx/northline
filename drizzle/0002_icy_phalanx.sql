ALTER TABLE `article_versions` ADD `published_at` integer;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_articles` (
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
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`current_version_id`) REFERENCES `article_versions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_articles`("id", "story_cluster_id", "slug", "category", "format", "state", "risk_level", "sensitive", "human_approval_required", "author_id", "current_version_id", "published_at", "scheduled_at", "created_at", "updated_at") SELECT "id", "story_cluster_id", "slug", "category", "format", "state", "risk_level", "sensitive", "human_approval_required", "author_id", "current_version_id", "published_at", "scheduled_at", "created_at", "updated_at" FROM `articles`;--> statement-breakpoint
DROP TABLE `articles`;--> statement-breakpoint
ALTER TABLE `__new_articles` RENAME TO `articles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `articles_slug_uq` ON `articles` (`slug`);--> statement-breakpoint
CREATE INDEX `articles_state_published_idx` ON `articles` (`state`,`published_at`);--> statement-breakpoint
CREATE INDEX `articles_cluster_idx` ON `articles` (`story_cluster_id`);--> statement-breakpoint
CREATE TRIGGER `articles_current_version_same_article_insert`
BEFORE INSERT ON `articles`
WHEN NEW.`current_version_id` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `article_versions`
    WHERE `id` = NEW.`current_version_id`
      AND `article_id` = NEW.`id`
  )
BEGIN
  SELECT RAISE(ABORT, 'current article version must belong to the same article');
END;--> statement-breakpoint
CREATE TRIGGER `articles_current_version_same_article_update`
BEFORE UPDATE OF `current_version_id` ON `articles`
WHEN NEW.`current_version_id` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `article_versions`
    WHERE `id` = NEW.`current_version_id`
      AND `article_id` = NEW.`id`
  )
BEGIN
  SELECT RAISE(ABORT, 'current article version must belong to the same article');
END;--> statement-breakpoint
CREATE TRIGGER `articles_published_state_requires_frozen_version`
BEFORE UPDATE OF `state` ON `articles`
WHEN NEW.`state` IN (
  'PUBLISHED',
  'DEVELOPING',
  'UPDATED',
  'CORRECTED',
  'RETRACTED',
  'ARCHIVED'
)
  AND (
    NEW.`published_at` IS NULL
    OR NEW.`current_version_id` IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM `article_versions`
      WHERE `id` = NEW.`current_version_id`
        AND `article_id` = NEW.`id`
        AND `published_at` IS NOT NULL
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'published article state requires a frozen current version');
END;--> statement-breakpoint
CREATE TRIGGER `articles_public_insert_requires_frozen_version`
BEFORE INSERT ON `articles`
WHEN NEW.`state` IN (
  'PUBLISHED',
  'DEVELOPING',
  'UPDATED',
  'CORRECTED',
  'RETRACTED',
  'ARCHIVED'
)
  AND (
    NEW.`published_at` IS NULL
    OR NEW.`current_version_id` IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM `article_versions`
      WHERE `id` = NEW.`current_version_id`
        AND `article_id` = NEW.`id`
        AND `published_at` IS NOT NULL
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'published article state requires a frozen current version');
END;--> statement-breakpoint
CREATE TRIGGER `articles_public_current_version_requires_frozen_version`
BEFORE UPDATE OF `current_version_id` ON `articles`
WHEN NEW.`state` IN (
  'PUBLISHED',
  'DEVELOPING',
  'UPDATED',
  'CORRECTED',
  'RETRACTED',
  'ARCHIVED'
)
  AND (
    NEW.`current_version_id` IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM `article_versions`
      WHERE `id` = NEW.`current_version_id`
        AND `article_id` = NEW.`id`
        AND `published_at` IS NOT NULL
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'public articles must point to a frozen version');
END;--> statement-breakpoint
CREATE TRIGGER `published_article_versions_no_update`
BEFORE UPDATE ON `article_versions`
WHEN OLD.`published_at` IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'published article versions are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `published_article_versions_no_delete`
BEFORE DELETE ON `article_versions`
WHEN OLD.`published_at` IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'published article versions are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `state_transitions_no_update`
BEFORE UPDATE ON `state_transitions`
BEGIN
  SELECT RAISE(ABORT, 'state transitions are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `state_transitions_no_delete`
BEFORE DELETE ON `state_transitions`
BEGIN
  SELECT RAISE(ABORT, 'state transitions are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `audit_logs_no_update`
BEFORE UPDATE ON `audit_logs`
BEGIN
  SELECT RAISE(ABORT, 'audit logs are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `audit_logs_no_delete`
BEFORE DELETE ON `audit_logs`
BEGIN
  SELECT RAISE(ABORT, 'audit logs are append-only');
END;
