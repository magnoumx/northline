-- Northline v2: durable queue ownership and non-overwritten attempt history.
ALTER TABLE `job_runs` ADD COLUMN `lease_owner` text;
ALTER TABLE `job_runs` ADD COLUMN `lease_expires_at` integer;
ALTER TABLE `job_runs` ADD COLUMN `last_heartbeat_at` integer;

CREATE INDEX `job_runs_lease_idx`
  ON `job_runs` (`state`, `lease_expires_at`);

CREATE TABLE `job_run_attempts` (
  `id` text PRIMARY KEY NOT NULL,
  `job_run_id` text NOT NULL,
  `attempt` integer NOT NULL,
  `lease_owner` text NOT NULL,
  `delivery_id` text NOT NULL,
  `state` text NOT NULL,
  `reason` text,
  `error_code` text,
  `error_message` text,
  `started_at` integer NOT NULL,
  `completed_at` integer,
  `next_retry_at` integer,
  FOREIGN KEY (`job_run_id`) REFERENCES `job_runs`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `job_run_attempts_state_ck`
    CHECK (`state` IN ('RUNNING','COMPLETED','SKIPPED','RETRY_WAIT','FAILED'))
);

CREATE UNIQUE INDEX `job_run_attempts_owner_uq`
  ON `job_run_attempts` (`lease_owner`);
CREATE INDEX `job_run_attempts_job_idx`
  ON `job_run_attempts` (`job_run_id`, `started_at`);
