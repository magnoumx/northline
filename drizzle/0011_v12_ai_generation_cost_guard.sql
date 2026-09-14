CREATE TABLE IF NOT EXISTS ai_generation_requests (
  id TEXT PRIMARY KEY NOT NULL,
  request_key TEXT NOT NULL UNIQUE,
  actor_id TEXT,
  workflow_id TEXT NOT NULL,
  headline TEXT NOT NULL,
  category TEXT NOT NULL,
  requested_format TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('RUNNING','COMPLETED','FAILED')),
  result_json TEXT,
  error_code TEXT,
  error_message TEXT,
  actual_cost_micros INTEGER NOT NULL DEFAULT 0 CHECK (actual_cost_micros >= 0),
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_generation_requests_state_started_idx
  ON ai_generation_requests(state, started_at);
CREATE INDEX IF NOT EXISTS ai_generation_requests_expires_idx
  ON ai_generation_requests(expires_at);
