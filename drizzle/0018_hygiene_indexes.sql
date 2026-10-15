-- The daily hygiene job deletes finished job_runs rows in bounded batches; the
-- predicate was a full scan over a table past 60k rows. This index makes the
-- delete a range seek. (audit_logs is append-only by trigger and is never pruned.)
CREATE INDEX IF NOT EXISTS `job_runs_completed_idx` ON `job_runs` (`completed_at`);
