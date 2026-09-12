-- Publisher metadata is independent of accreditation certificates and OJ caches.
CREATE TABLE IF NOT EXISTS publisher_catalog (
  reference_key TEXT PRIMARY KEY,
  designation TEXT NOT NULL,
  provider TEXT NOT NULL,
  auto_json TEXT,
  manual_json TEXT,
  source_url TEXT,
  attempted_at TEXT,
  checked_at TEXT,
  error TEXT,
  next_check_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'
);
CREATE INDEX IF NOT EXISTS idx_publisher_catalog_due ON publisher_catalog(next_check_at);

CREATE TABLE IF NOT EXISTS publisher_catalog_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference_key TEXT NOT NULL REFERENCES publisher_catalog(reference_key),
  origin TEXT NOT NULL CHECK(origin IN ('automatic', 'manual', 'clear_manual')),
  payload_json TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_publisher_catalog_history ON publisher_catalog_history(reference_key, id DESC);

CREATE TABLE IF NOT EXISTS publisher_sync_lock (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  owner TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
