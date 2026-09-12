-- JAB / A2LA 認定スコープ（ISO/IEC 17025）
--
-- 正本は static/data/{a2la,jab}-scopes.md。scripts/seed-from-md.mjs が MD を読んで seed/scopes.sql を生成し、
-- このスキーマに投入する。MD の内容（ハッシュ）が変わるたびに certificates に新しい行ができ、
-- 古い行は is_current = 0 で残る（認定書の改訂履歴）。

CREATE TABLE IF NOT EXISTS certificates (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  cert_type              TEXT    NOT NULL,              -- 'a2la' | 'jab'
  certificate_number     TEXT,
  organization           TEXT,
  accreditation_body     TEXT,
  valid_until            TEXT,                          -- 'YYYY-MM-DD'
  accreditation_standard TEXT,
  extra_info             TEXT,                          -- MD 先頭メタデータのうち上記以外（JSON）
  source_file            TEXT    NOT NULL,              -- 例: 'static/data/jab-scopes.md'
  source_hash            TEXT    NOT NULL,              -- MD 内容の SHA-256（同じ内容の二重投入を防ぐ）
  imported_at            TEXT    NOT NULL,              -- ISO 8601
  is_current             INTEGER NOT NULL DEFAULT 1,
  UNIQUE (cert_type, source_hash)
);

CREATE TABLE IF NOT EXISTS facilities (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  certificate_id  INTEGER NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  facility_number TEXT    NOT NULL,                     -- '1', '2', ...
  name            TEXT    NOT NULL,
  location        TEXT,
  anchor          TEXT                                  -- MD 内アンカー（'#facility-1'）
);

CREATE TABLE IF NOT EXISTS scope_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  certificate_id  INTEGER NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  facility_id     INTEGER REFERENCES facilities(id) ON DELETE SET NULL,
  category        TEXT,                                 -- 'M21.4.1 Continuous Disturbance Tests' など
  anchor          TEXT,                                 -- '#facility-1-continuous-disturbance'
  standard        TEXT    NOT NULL,                     -- 'EN 55032'
  description     TEXT,                                 -- 'ITE only' / 'except 10' など
  core            TEXT,                                 -- 正規化した番号 '55032' / '301-489-1'（検索用）
  sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_certificates_current ON certificates (cert_type, is_current);
CREATE INDEX IF NOT EXISTS idx_scope_items_cert     ON scope_items (certificate_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_scope_items_core     ON scope_items (core);
CREATE INDEX IF NOT EXISTS idx_facilities_cert      ON facilities (certificate_id);
