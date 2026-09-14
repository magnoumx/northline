CREATE TABLE `article_audio_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `article_id` text NOT NULL,
  `article_version_id` text NOT NULL,
  `variant` text NOT NULL,
  `state` text DEFAULT 'NOT_REQUESTED' NOT NULL,
  `input_hash` text NOT NULL,
  `narration_policy_version` text NOT NULL,
  `provider` text,
  `model_id` text,
  `voice_id` text,
  `output_format` text,
  `content_type` text,
  `character_count` integer DEFAULT 0 NOT NULL,
  `chunk_count` integer DEFAULT 0 NOT NULL,
  `estimated_cost_micros` integer DEFAULT 0 NOT NULL,
  `actual_cost_micros` integer,
  `duration_ms` integer,
  `storage_bucket` text,
  `storage_key` text,
  `storage_etag` text,
  `storage_checksum` text,
  `storage_byte_length` integer,
  `chapter_timings_json` text DEFAULT '[]' NOT NULL,
  `speech_timings_json` text DEFAULT '[]' NOT NULL,
  `disclosure` text DEFAULT 'AI-generated narration' NOT NULL,
  `download_allowed` integer DEFAULT false NOT NULL,
  `generation_attempt` integer DEFAULT 0 NOT NULL,
  `queue_job_id` text,
  `requested_by_id` text,
  `failure_code` text,
  `failure_digest` text,
  `requested_at` integer,
  `generation_started_at` integer,
  `processing_started_at` integer,
  `ready_at` integer,
  `failed_at` integer,
  `stale_at` integer,
  `rejected_at` integer,
  `cooldown_until` integer,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`article_version_id`) REFERENCES `article_versions`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT `article_audio_variant_ck` CHECK(`variant` IN ('FULL_ARTICLE','QUICK_BRIEF')),
  CONSTRAINT `article_audio_state_ck` CHECK(`state` IN ('NOT_REQUESTED','QUEUED','GENERATING','PROCESSING','READY','FAILED','STALE','REJECTED')),
  CONSTRAINT `article_audio_provider_ck` CHECK(`provider` IS NULL OR `provider` IN ('OPENAI_TTS','GOOGLE_CLOUD_TTS','ELEVENLABS')),
  CONSTRAINT `article_audio_cost_ck` CHECK(`estimated_cost_micros` >= 0 AND (`actual_cost_micros` IS NULL OR `actual_cost_micros` >= 0)),
  CONSTRAINT `article_audio_size_ck` CHECK(`character_count` >= 0 AND `chunk_count` >= 0 AND `generation_attempt` >= 0),
  CONSTRAINT `article_audio_ready_ck` CHECK(`state` <> 'READY' OR (`provider` IS NOT NULL AND `model_id` IS NOT NULL AND `voice_id` IS NOT NULL AND `content_type` LIKE 'audio/%' AND `duration_ms` > 0 AND `storage_bucket` IS NOT NULL AND `storage_key` IS NOT NULL AND `storage_checksum` IS NOT NULL AND `storage_byte_length` > 0 AND `ready_at` IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_audio_version_variant_uq` ON `article_audio_versions` (`article_version_id`,`variant`);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_audio_storage_key_uq` ON `article_audio_versions` (`storage_key`);
--> statement-breakpoint
CREATE INDEX `article_audio_article_state_idx` ON `article_audio_versions` (`article_id`,`state`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `article_audio_queue_state_idx` ON `article_audio_versions` (`state`,`requested_at`);
--> statement-breakpoint
CREATE TABLE `article_audio_chunks` (
  `id` text PRIMARY KEY NOT NULL,
  `article_audio_version_id` text NOT NULL,
  `ordinal` integer NOT NULL,
  `chapter_index` integer NOT NULL,
  `text_hash` text NOT NULL,
  `character_count` integer NOT NULL,
  `state` text DEFAULT 'QUEUED' NOT NULL,
  `provider` text NOT NULL,
  `provider_request_id_hash` text,
  `content_type` text,
  `temporary_storage_key` text,
  `duration_ms` integer,
  `cost_micros` integer DEFAULT 0 NOT NULL,
  `generation_attempt` integer NOT NULL,
  `timing_json` text DEFAULT '[]' NOT NULL,
  `failure_code` text,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`article_audio_version_id`) REFERENCES `article_audio_versions`(`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `article_audio_chunk_state_ck` CHECK(`state` IN ('QUEUED','GENERATING','READY','FAILED')),
  CONSTRAINT `article_audio_chunk_bounds_ck` CHECK(`ordinal` >= 0 AND `chapter_index` >= 0 AND `character_count` > 0 AND `cost_micros` >= 0 AND `generation_attempt` >= 1),
  CONSTRAINT `article_audio_chunk_ready_ck` CHECK(`state` <> 'READY' OR (`content_type` LIKE 'audio/%' AND `temporary_storage_key` IS NOT NULL AND `duration_ms` > 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_audio_chunks_ordinal_uq` ON `article_audio_chunks` (`article_audio_version_id`,`ordinal`);
--> statement-breakpoint
CREATE INDEX `article_audio_chunks_state_idx` ON `article_audio_chunks` (`article_audio_version_id`,`state`);
--> statement-breakpoint
CREATE TABLE `article_audio_cost_ledger` (
  `id` text PRIMARY KEY NOT NULL,
  `article_audio_version_id` text NOT NULL,
  `article_version_id` text NOT NULL,
  `provider` text NOT NULL,
  `entry_type` text NOT NULL,
  `amount_micros` integer NOT NULL,
  `budget_date` text NOT NULL,
  `idempotency_key_hash` text NOT NULL,
  `recorded_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`article_audio_version_id`) REFERENCES `article_audio_versions`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`article_version_id`) REFERENCES `article_versions`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `article_audio_cost_entry_type_ck` CHECK(`entry_type` IN ('RESERVATION','ACTUAL','RELEASE')),
  CONSTRAINT `article_audio_cost_amount_ck` CHECK(`amount_micros` >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_audio_cost_idempotency_uq` ON `article_audio_cost_ledger` (`idempotency_key_hash`);
--> statement-breakpoint
CREATE INDEX `article_audio_cost_budget_idx` ON `article_audio_cost_ledger` (`budget_date`,`entry_type`,`recorded_at`);
--> statement-breakpoint
CREATE INDEX `article_audio_cost_version_idx` ON `article_audio_cost_ledger` (`article_audio_version_id`,`recorded_at`);
--> statement-breakpoint
CREATE TABLE `article_audio_progress` (
  `user_id` text NOT NULL,
  `article_audio_version_id` text NOT NULL,
  `position_ms` integer DEFAULT 0 NOT NULL,
  `duration_ms` integer NOT NULL,
  `completed_at` integer,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  PRIMARY KEY (`user_id`,`article_audio_version_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`article_audio_version_id`) REFERENCES `article_audio_versions`(`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT `article_audio_progress_bounds_ck` CHECK(`position_ms` >= 0 AND `duration_ms` > 0 AND `position_ms` <= `duration_ms`)
);
--> statement-breakpoint
CREATE INDEX `article_audio_progress_user_idx` ON `article_audio_progress` (`user_id`,`updated_at`);
--> statement-breakpoint
CREATE TRIGGER `article_audio_state_transition_guard`
BEFORE UPDATE OF `state` ON `article_audio_versions`
WHEN NOT (
  OLD.`state` = NEW.`state`
  OR (OLD.`state` = 'NOT_REQUESTED' AND NEW.`state` IN ('QUEUED','REJECTED'))
  OR (OLD.`state` = 'QUEUED' AND NEW.`state` IN ('GENERATING','FAILED','STALE','REJECTED'))
  OR (OLD.`state` = 'GENERATING' AND NEW.`state` IN ('PROCESSING','FAILED','STALE'))
  OR (OLD.`state` = 'PROCESSING' AND NEW.`state` IN ('READY','FAILED','STALE'))
  OR (OLD.`state` = 'READY' AND NEW.`state` = 'STALE')
  OR (OLD.`state` = 'FAILED' AND NEW.`state` IN ('QUEUED','STALE','REJECTED'))
  OR (OLD.`state` = 'STALE' AND NEW.`state` IN ('QUEUED','REJECTED'))
  OR (OLD.`state` = 'REJECTED' AND NEW.`state` = 'QUEUED')
)
BEGIN
  SELECT RAISE(ABORT, 'invalid article audio state transition');
END;
--> statement-breakpoint
CREATE TRIGGER `article_audio_ready_artifact_immutable`
BEFORE UPDATE ON `article_audio_versions`
WHEN OLD.`state` = 'READY' AND (
  NEW.`article_id` <> OLD.`article_id`
  OR NEW.`article_version_id` <> OLD.`article_version_id`
  OR NEW.`variant` <> OLD.`variant`
  OR NEW.`input_hash` <> OLD.`input_hash`
  OR COALESCE(NEW.`provider`, '') <> COALESCE(OLD.`provider`, '')
  OR COALESCE(NEW.`model_id`, '') <> COALESCE(OLD.`model_id`, '')
  OR COALESCE(NEW.`voice_id`, '') <> COALESCE(OLD.`voice_id`, '')
  OR COALESCE(NEW.`storage_bucket`, '') <> COALESCE(OLD.`storage_bucket`, '')
  OR COALESCE(NEW.`storage_key`, '') <> COALESCE(OLD.`storage_key`, '')
  OR COALESCE(NEW.`storage_checksum`, '') <> COALESCE(OLD.`storage_checksum`, '')
)
BEGIN
  SELECT RAISE(ABORT, 'ready article audio artifacts are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `article_audio_cost_ledger_no_update`
BEFORE UPDATE ON `article_audio_cost_ledger`
BEGIN
  SELECT RAISE(ABORT, 'article audio cost ledger is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `article_audio_cost_ledger_no_delete`
BEFORE DELETE ON `article_audio_cost_ledger`
BEGIN
  SELECT RAISE(ABORT, 'article audio cost ledger is append-only');
END;
