CREATE TABLE IF NOT EXISTS autonomous_story_runs (
  id TEXT PRIMARY KEY NOT NULL,
  trend_id TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL DEFAULT 'QUEUED',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  article_id TEXT,
  article_version_id TEXT,
  quality_score INTEGER,
  word_count INTEGER,
  cost_micros INTEGER NOT NULL DEFAULT 0,
  decision_reasons_json TEXT NOT NULL DEFAULT '[]',
  error_code TEXT,
  error_message TEXT,
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CONSTRAINT autonomous_story_runs_state_ck CHECK (
    state IN ('QUEUED','RUNNING','COMPLETED','REVIEW_REQUIRED','FAILED')
  ),
  CONSTRAINT autonomous_story_runs_bounds_ck CHECK (
    attempt_count >= 0 AND cost_micros >= 0 AND
    (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100)) AND
    (word_count IS NULL OR word_count >= 0)
  ),
  FOREIGN KEY (trend_id) REFERENCES trends(id) ON DELETE CASCADE,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE SET NULL,
  FOREIGN KEY (article_version_id) REFERENCES article_versions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS autonomous_story_runs_state_updated_idx
  ON autonomous_story_runs(state, updated_at);
CREATE INDEX IF NOT EXISTS autonomous_story_runs_created_idx
  ON autonomous_story_runs(created_at);
