-- Autonomous candidate-selection performance indexes.
--
-- The daily draft scheduler joins `autonomous_story_runs` to `trends` by
-- `trend_id` (a LEFT JOIN plus a correlated NOT EXISTS de-duplication) for every
-- candidate trend. With no index on `autonomous_story_runs.trend_id`, that was a
-- full scan of the runs table per trend; once `trends` passed ~20k rows the
-- query exceeded D1's per-query CPU limit and the pipeline stopped drafting
-- entirely (job_runs: D1_ERROR "exceeded its CPU time limit").
--
-- The trend_id index turns those lookups into index seeks. The composite
-- (editorial_state, latest_detected_at) index supports the recency bound the
-- scheduler now applies so the scan stays cheap as the trends archive grows.

CREATE INDEX IF NOT EXISTS autonomous_story_runs_trend_idx
  ON autonomous_story_runs (trend_id);

CREATE INDEX IF NOT EXISTS trends_state_latest_idx
  ON trends (editorial_state, latest_detected_at);
