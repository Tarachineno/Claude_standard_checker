-- Private operator identity; never embedded in public catalogue history payloads.
CREATE TABLE publisher_admin_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('manual','clear_manual')),
  actor_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);
CREATE INDEX idx_publisher_admin_audit_reference ON publisher_admin_audit(reference_key, recorded_at);
