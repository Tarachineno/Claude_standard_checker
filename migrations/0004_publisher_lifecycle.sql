-- Additive migration; existing records, review runs, scopes and notices are retained.
ALTER TABLE publisher_changes ADD COLUMN before_state_json TEXT;
ALTER TABLE publisher_changes ADD COLUMN after_state_json TEXT;
ALTER TABLE publisher_changes ADD COLUMN change_kind TEXT NOT NULL DEFAULT 'edition';

CREATE TABLE publisher_review_contract (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  min_schema_version INTEGER NOT NULL
);
INSERT INTO publisher_review_contract VALUES (1, 2);

-- Reject an old running CLI even if it has already generated its SQL before migration.
CREATE TRIGGER publisher_review_v2_insert BEFORE INSERT ON publisher_catalog
WHEN json_extract(NEW.manual_json, '$.verification_method') = 'scheduled_review'
 AND json_extract(NEW.manual_json, '$.review_schema_version') IS NOT 2
BEGIN
  SELECT RAISE(ABORT, 'Publisher review schema v2 required; re-export with the current CLI');
END;
CREATE TRIGGER publisher_review_v2_update BEFORE UPDATE OF manual_json ON publisher_catalog
WHEN NEW.manual_json IS NOT OLD.manual_json
 AND json_extract(NEW.manual_json, '$.verification_method') = 'scheduled_review'
 AND json_extract(NEW.manual_json, '$.review_schema_version') IS NOT 2
BEGIN
  SELECT RAISE(ABORT, 'Publisher review schema v2 required; re-export with the current CLI');
END;

-- Legacy manual forms must not silently remove confirmed withdrawal information.
CREATE TRIGGER publisher_lifecycle_preserve BEFORE UPDATE OF manual_json, auto_json ON publisher_catalog
WHEN json_extract(COALESCE(OLD.manual_json, OLD.auto_json), '$.lifecycle.status') = 'withdrawn'
 AND (json_extract(COALESCE(NEW.manual_json, NEW.auto_json), '$.review_schema_version') IS NOT 2
      OR json_extract(COALESCE(NEW.manual_json, NEW.auto_json), '$.lifecycle.status') IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'Use the lifecycle review workflow to change a withdrawn reference');
END;
