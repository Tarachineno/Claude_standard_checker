import { parseStandardReferences, parseEditions, editionLabel } from './references.js';
import { fetchPublisher, officialUrl, SEARCH_URLS, AUTOMATIC_PROVIDERS } from './publishers.js';
import { loadScopeDocument, CERT_TYPES } from './scopes.js';
import { isWithdrawnRecord } from './publisher-lifecycle.js';
import { checkPublished } from './scope-oj.js';
import { adminAudit } from './catalog-auth.js';

export function inventoryOf(documents) {
  const refs = new Map();
  for (const { doc } of documents) for (const item of doc.items) {
    for (const ref of parseStandardReferences(item.standard)) {
      const entry = refs.get(ref.key) || { ...ref, scope_count: 0 };
      entry.scope_count++;
      refs.set(ref.key, entry);
    }
  }
  return [...refs.values()];
}

export async function loadCatalog(c) {
  if (!c.env.DB) return { available: false, error: 'Catalogue database is not configured', records: [] };
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM publisher_catalog ORDER BY reference_key').all();
    let reviewAttempts = new Map();
    // Older installations remain readable before the additive review migrations.
    const { results: tables } = await c.env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='publisher_review_results'").all();
    if (tables.length) {
      const { results: attempts } = await c.env.DB.prepare(`SELECT reference_key,outcome,reason,completed_at FROM (
        SELECT r.reference_key,r.outcome,r.reason,u.completed_at,
          ROW_NUMBER() OVER (PARTITION BY r.reference_key ORDER BY u.completed_at DESC,u.run_id DESC) AS position
        FROM publisher_review_results r JOIN publisher_review_runs u ON u.run_id=r.run_id
      ) WHERE position=1`).all();
      reviewAttempts = new Map(attempts.map(attempt => [attempt.reference_key, attempt]));
    }
    return { available: true, records: results.map(row => {
      const auto = row.auto_json ? JSON.parse(row.auto_json) : null;
      const manual = row.manual_json ? JSON.parse(row.manual_json) : null;
      return { key: row.reference_key, designation: row.designation, provider: row.provider,
        ...(manual || auto || {}), source_url: (manual || auto)?.source_url || row.source_url,
        origin: manual?.verification_method === 'scheduled_review' ? 'review' : manual ? 'manual' : 'automatic', error: manual ? null : row.error,
        automatic_error: row.error, attempted_at: row.attempted_at, next_check_at: row.next_check_at,
        automatic: manual ? auto : null,
        latest_review: reviewAttempts.get(row.reference_key) || null,
      };
    }) };
  } catch (err) {
    console.error('[catalog]', err.message);
    return { available: false, error: 'Catalogue unavailable. Check database migrations.', records: [] };
  }
}

export function validateManual(input, now = new Date().toISOString()) {
  if (!input || typeof input.reference !== 'string' || input.reference.length > 150) throw new Error('A standard reference is required');
  const refs = parseStandardReferences(input.reference);
  if (refs.length !== 1 || refs[0].editions.length || refs[0].edition_unparsed) throw new Error('Use one standard reference without an edition');
  const ref = refs[0];
  if (!officialUrl(input.source_url)) throw new Error('An HTTPS official source URL is required');
  const status = input.status || 'published';
  if (!['published', 'withdrawn', 'draft'].includes(status)) throw new Error('Invalid publication status');
  const date = input.publication_date || null;
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date > now.slice(0, 10))) throw new Error('Invalid publication date');
  if (typeof input.edition !== 'string' || input.edition.length > 150) throw new Error('One edition is required');
  if (!/^(?:\d{4}|V\d+(?:\.\d+){0,3}|(?:Issue|Ed)\s+\d+(?:\.\d+)*)(?:\+(?:A|COR)\d*(?::\d{4})?)*$/i.test(input.edition)) throw new Error('Invalid edition syntax; use e.g. 2020+A1:2024, V2.2.2 or Issue 6');
  const parsed = parseEditions(':' + input.edition);
  if (parsed.edition_unparsed || parsed.editions.length !== 1) throw new Error('Use one edition including amendments / corrigenda');
  if (typeof input.note !== 'string' || !input.note.trim() || input.note.length > 1000) throw new Error('A verification note is required (up to 1000 characters)');
  const edition = parsed.editions[0];
  return { key: ref.key, designation: ref.designation, provider: ref.provider, source_url: input.source_url,
    checked_at: now, origin: 'manual', note: input.note.trim(), editions: [{ designation: ref.designation + ':' + editionLabel(edition), edition, status, publication_date: date, source_url: input.source_url }] };
}

export async function saveManual(db, record, actor = null) {
  const old = await db.prepare('SELECT manual_json,auto_json FROM publisher_catalog WHERE reference_key=?1').bind(record.key).first();
  if (old && isWithdrawnRecord(JSON.parse(old.manual_json || old.auto_json || 'null'))) throw new Error('Use the lifecycle review workflow to change a withdrawn reference');
  const payload = JSON.stringify(record);
  await db.batch([
    db.prepare(`INSERT INTO publisher_catalog(reference_key, designation, provider, manual_json, source_url) VALUES (?1,?2,?3,?4,?5)
      ON CONFLICT(reference_key) DO UPDATE SET manual_json=excluded.manual_json, source_url=excluded.source_url`)
      .bind(record.key, record.designation, record.provider, payload, record.source_url),
    db.prepare(`INSERT INTO publisher_catalog_history(reference_key, origin, payload_json, recorded_at) VALUES (?1,'manual',?2,?3)`)
      .bind(record.key, payload, record.checked_at),
    ...adminAudit(db, actor, record.key, 'manual', record.checked_at),
  ]);
}

export async function syncCatalog(c, { keys, limit = 5, force = false } = {}) {
  if (!c.env.DB) throw new Error('Catalogue database is not configured');
  const db = c.env.DB, now = new Date().toISOString(), owner = crypto.randomUUID();
  const lock = await db.prepare(`INSERT INTO publisher_sync_lock(id,owner,expires_at) VALUES (1,?1,?2)
    ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE publisher_sync_lock.expires_at < ?3`)
    .bind(owner, new Date(Date.now() + 10 * 60000).toISOString(), now).run();
  if (!lock.meta.changes) return { busy: true, results: [] };
  try {
    const documents = await Promise.all(CERT_TYPES.map(async certType => ({ certType, ...await loadScopeDocument(c, certType) })));
    const inventory = inventoryOf(documents);
    // Register new references; never change accreditation records.
    for (let start = 0; start < inventory.length; start += 40) {
      await db.batch(inventory.slice(start, start + 40).map(ref => db.prepare(`INSERT OR IGNORE INTO publisher_catalog(reference_key,designation,provider) VALUES (?1,?2,?3)`).bind(ref.key, ref.designation, ref.provider)));
    }
    const { records, available } = await loadCatalog(c);
    if (!available) throw new Error('Catalogue database unavailable');
    const byKey = new Map(inventory.map(r => [r.key, r]));
    const chosen = records.filter(r => (keys ? keys.includes(r.key) : AUTOMATIC_PROVIDERS.includes(r.provider)) && (force || r.next_check_at <= now))
      .sort((a, b) => a.next_check_at.localeCompare(b.next_check_at)).slice(0, Math.min(10, Math.max(1, limit)));
    const results = [];
    for (const record of chosen) {
      if (isWithdrawnRecord(record)) {
        results.push({ key: record.key, success: false, error: 'Use the lifecycle review workflow for withdrawal and replacement verification' });
        continue;
      }
      const ref = byKey.get(record.key) || parseStandardReferences(record.designation)[0];
      if (!ref) continue;
      const attempted = new Date().toISOString();
      try {
        const fetched = await fetchPublisher(ref, record.source_url);
        const payload = JSON.stringify(fetched);
        await db.batch([
          db.prepare(`UPDATE publisher_catalog SET auto_json=?1,checked_at=?2,attempted_at=?2,error=NULL,next_check_at=?3 WHERE reference_key=?4`)
            .bind(payload, fetched.checked_at, new Date(Date.now() + 7 * 86400000).toISOString(), ref.key),
          db.prepare(`INSERT INTO publisher_catalog_history(reference_key,origin,payload_json,recorded_at) VALUES (?1,'automatic',?2,?3)`)
            .bind(ref.key, payload, fetched.checked_at),
        ]);
        results.push({ key: ref.key, success: true, editions: fetched.editions.map(e => e.designation) });
      } catch (err) {
        const error = String(err.message).slice(0, 250);
        // Keep the last successful value and record the failed attempt, never empty it out.
        await db.prepare(`UPDATE publisher_catalog SET attempted_at=?1,error=?2,next_check_at=?3 WHERE reference_key=?4`)
          .bind(attempted, error, new Date(Date.now() + 86400000).toISOString(), ref.key).run();
        results.push({ key: ref.key, success: false, error });
      }
    }
    return { busy: false, total_references: inventory.length, processed: results.length, results };
  } finally {
    await db.prepare('DELETE FROM publisher_sync_lock WHERE id=1 AND owner=?1').bind(owner).run();
  }
}

export function withSearchLinks(inventory, records) {
  const map = new Map(records.map(r => [r.key, r]));
  return inventory.map(ref => {
    const record = map.get(ref.key);
    return { ...ref, automatic_supported: AUTOMATIC_PROVIDERS.includes(ref.provider), search_url: SEARCH_URLS[ref.provider]?.(ref) || null,
      record: isWithdrawnRecord(record) ? { ...record, replacement_checks: record.lifecycle.replacements.map(replacement => ({
        ...replacement, published: checkPublished(parseStandardReferences(replacement.reference)[0], map.get(replacement.key), new Date().toISOString().slice(0, 10)),
      })) } : record || null };
  });
}
