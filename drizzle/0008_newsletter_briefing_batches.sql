CREATE TABLE IF NOT EXISTS newsletter_signup_batches (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  lists_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  confirmation_token_hash TEXT NOT NULL,
  confirmation_token_expires_at INTEGER NOT NULL,
  consent_source TEXT NOT NULL,
  consented_at INTEGER NOT NULL,
  confirmed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_signup_batches_token_uq
  ON newsletter_signup_batches (confirmation_token_hash);
CREATE INDEX IF NOT EXISTS newsletter_signup_batches_email_status_idx
  ON newsletter_signup_batches (email, status, created_at);
