-- Weekly research audit and semantic Published-edition change notifications.
-- No changes to accreditation, OJ, or existing publisher records.
CREATE TABLE publisher_review_runs (
  run_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  target_count INTEGER NOT NULL,
  runner TEXT NOT NULL,
  report_hash TEXT NOT NULL
);
CREATE TABLE publisher_review_results (
  run_id TEXT NOT NULL REFERENCES publisher_review_runs(run_id),
  reference_key TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('changed','unchanged','unverified','conflict')),
  reason TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  checked_at TEXT,
  PRIMARY KEY(run_id, reference_key)
);
CREATE TABLE publisher_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES publisher_review_runs(run_id),
  reference_key TEXT NOT NULL,
  designation TEXT NOT NULL,
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  source_url TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  UNIQUE(run_id, reference_key)
);
CREATE INDEX idx_publisher_changes_detected ON publisher_changes(detected_at);
