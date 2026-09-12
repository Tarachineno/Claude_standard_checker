import { inventoryOf, validateManual } from './catalog.js';
import { editionLabel, parseStandardReferences } from './references.js';
import { SEARCH_URLS } from './publishers.js';

export const REVIEW_SCHEMA = 1;
export const PUBLISHED_BANNER_DAYS = 7;
const DAY = 86400000;
const SOURCE_HOSTS = {
  etsi: ['etsi.org'], cenelec: ['cencenelec.eu'], iec: ['iec.ch'], iso: ['iso.org'],
  ieee: ['ieee.org', 'ansi.org'], ised: ['ised-isde.canada.ca'], jisc: ['jisc.go.jp'],
  ks: ['standard.go.kr'], vcci: ['vcci.jp'], fcc: ['fcc.gov', 'ecfr.gov'],
  semi: ['semi.org'], as_nzs: ['standards.org.au', 'standards.govt.nz'],
};
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const q = value => value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
const asJson = value => JSON.stringify(value);
export const effectiveRecord = row => row?.manual_json ? JSON.parse(row.manual_json) : row?.auto_json ? JSON.parse(row.auto_json) : null;
export async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(asJson(value)));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function publishedSet(record) {
  // Confirmation times, evidence, ordering and drafts are NOT edition changes.
  return [...new Set((record?.editions || []).filter(e => e.status === 'published').map(e =>
    editionLabel({ base: e.edition.base, amendments: [...(e.edition.amendments || [])].sort(), corrections: [...(e.edition.corrections || [])].sort() })
  ))].sort();
}
export function providerSource(url, provider) {
  try {
    if (typeof url !== 'string' || url.length > 2048) return false;
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443')
      && (SOURCE_HOSTS[provider] || []).some(host => u.hostname === host || u.hostname.endsWith('.' + host));
  } catch { return false; }
}

export async function readReviewState(db) {
  const { results: certificates } = await db.prepare('SELECT id,cert_type,source_hash FROM certificates WHERE is_current=1 ORDER BY id').all();
  requireThat(certificates.length > 0, 'No current D1 accreditations; MD fallback is not allowed');
  const { results: items } = await db.prepare('SELECT s.standard FROM scope_items s JOIN certificates c ON c.id=s.certificate_id WHERE c.is_current=1 ORDER BY s.id').all();
  requireThat(items.length > 0, 'Current D1 scopes are empty');
  const { results: rows } = await db.prepare('SELECT * FROM publisher_catalog ORDER BY reference_key').all();
  const { results: schema } = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('publisher_review_runs','publisher_review_results','publisher_changes')").all();
  requireThat(schema.length === 3, 'Apply migration 0003 before running the weekly review');
  const inventory = inventoryOf([{ doc: { items } }]).sort((a, b) => a.key.localeCompare(b.key));
  const recognized = new Set(inventory.flatMap(ref => [ref.key]));
  // Unknown source strings must remain visible to the researcher, never silently counted as checked.
  const unresolved = [...new Set(items.filter(item => !inventoryOf([{ doc: { items: [item] } }]).some(ref => recognized.has(ref.key))).map(item => item.standard))];
  return { certificates, inventory, rows, unresolved };
}

export async function createManifest(state, now = new Date().toISOString(), runId = crypto.randomUUID()) {
  const byKey = new Map(state.rows.map(row => [row.reference_key, row]));
  const targets = [];
  for (const ref of state.inventory) {
    const row = byKey.get(ref.key) || null;
    targets.push({ key: ref.key, reference: ref.designation, provider: ref.provider, scope_count: ref.scope_count,
      expected_hash: await digest(row), current: effectiveRecord(row), search_url: SEARCH_URLS[ref.provider]?.(ref) || null,
      allowed_hosts: SOURCE_HOSTS[ref.provider] || [] });
  }
  return { schema_version: REVIEW_SCHEMA, run_id: runId, started_at: now,
    scope_hash: await digest(state.certificates), targets, unresolved_scope_strings: state.unresolved };
}

function validDate(value, start, now) {
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  requireThat(Number.isFinite(time) && new Date(time).toISOString() === value, 'Use an ISO UTC verification timestamp');
  requireThat(time >= Date.parse(start) && time <= Date.parse(now) + 60000, 'Verification timestamp must be within this run');
}

export function validateReport(manifest, input, now = new Date().toISOString()) {
  requireThat(manifest.schema_version === REVIEW_SCHEMA && input.schema_version === REVIEW_SCHEMA, 'Unsupported review schema');
  requireThat(typeof manifest.run_id === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(manifest.run_id) && input.run_id === manifest.run_id, 'Mismatched run_id');
  validDate(manifest.started_at, manifest.started_at, now);
  requireThat(Date.parse(now) - Date.parse(manifest.started_at) <= 2 * DAY, 'Manifest expired; export a fresh manifest');
  requireThat(typeof input.runner === 'string' && input.runner.trim().length > 0 && input.runner.length <= 150, 'A runner identifier is required');
  requireThat(Array.isArray(manifest.targets) && manifest.targets.length > 0 && manifest.targets.length <= 2000, 'Invalid manifest targets');
  const targets = new Map(manifest.targets.map(ref => [ref.key, ref]));
  requireThat(targets.size === manifest.targets.length, 'Duplicate manifest target');
  requireThat(Array.isArray(input.results) && input.results.length === targets.size, 'Every target needs exactly one result; mark failures unverified');
  const seen = new Set();
  return input.results.map(result => {
    requireThat(result && targets.has(result.key) && !seen.has(result.key), 'Unknown or duplicate result key');
    seen.add(result.key);
    const target = targets.get(result.key);
    requireThat(result.expected_hash === target.expected_hash, 'Mismatched expected_hash');
    requireThat(typeof result.note === 'string' && result.note.trim().length > 0 && result.note.length <= 1000, 'A verification / failure note is required');
    if (result.outcome === 'unverified') return { key: result.key, outcome: 'unverified', note: result.note.trim(), evidence: [] };
    requireThat(result.outcome === 'verified', 'Outcome must be verified or unverified');
    requireThat(typeof result.source_reference === 'string' && result.source_reference.length <= 150, 'Official source designation is required');
    const sourceReferences = parseStandardReferences(result.source_reference);
    requireThat(sourceReferences.length === 1 && sourceReferences[0].key === target.key && !sourceReferences[0].edition_unparsed,
      'Official designation does not match the target; successor/adoption relationships require review');
    validDate(result.checked_at, manifest.started_at, now);
    requireThat(result.coverage === 'current_published_set', 'Explicit current Published set verification is required');
    requireThat(Array.isArray(result.evidence) && result.evidence.length > 0 && result.evidence.length <= 10, 'Official evidence is required');
    const evidence = result.evidence.map(source => {
      requireThat(source && providerSource(source.url, target.provider), 'Source must belong to the reference publisher');
      requireThat(typeof source.title === 'string' && source.title.trim() && source.title.length <= 300, 'Evidence title is required');
      requireThat(typeof source.finding === 'string' && source.finding.trim() && source.finding.length <= 1000, 'Evidence finding is required');
      validDate(source.retrieved_at, manifest.started_at, now);
      requireThat(Date.parse(source.retrieved_at) <= Date.parse(result.checked_at), 'Evidence must precede verification');
      return { url: source.url, title: source.title.trim(), finding: source.finding.trim(), retrieved_at: source.retrieved_at };
    });
    requireThat(Array.isArray(result.editions) && result.editions.length > 0 && result.editions.length <= 20, 'Explicit editions / withdrawal evidence are required');
    const editions = result.editions.map(entry => {
      requireThat(entry && ['published', 'withdrawn', 'draft'].includes(entry.status), 'Explicit edition status is required');
      requireThat(evidence.some(source => source.url === entry.source_url), 'Each edition needs a retrieved evidence URL');
      const normalized = validateManual({ reference: target.reference, edition: entry.edition, status: entry.status,
        publication_date: entry.publication_date, source_url: entry.source_url, note: result.note }, result.checked_at);
      return normalized.editions[0];
    });
    requireThat(new Set(editions.map(e => editionLabel(e.edition))).size === editions.length, 'Duplicate / conflicting edition entries');
    if (!editions.some(e => e.status === 'published')) {
      requireThat(result.no_current_published === true && editions.some(e => e.status === 'withdrawn'), 'A draft alone does not replace a Published edition');
    }
    const record = { key: target.key, designation: target.reference, provider: target.provider, source_url: evidence[0].url,
      checked_at: result.checked_at, origin: 'manual', verification_method: 'scheduled_review',
      run_id: manifest.run_id, runner: input.runner.trim(), note: result.note.trim(), evidence, editions };
    return { key: result.key, outcome: 'verified', note: result.note.trim(), evidence, record };
  });
}

// SQL is generated only from validated structured results, never accepted from a researcher.
// Every mutation is compare-and-swap protected and run/result keys make retry idempotent.
export async function buildReviewSql(state, manifest, input, now = new Date().toISOString()) {
  const results = validateReport(manifest, input, now);
  const fresh = await createManifest(state, now, manifest.run_id);
  requireThat(manifest.scope_hash === fresh.scope_hash, 'Current accreditation revisions changed; export again');
  const targets = new Map(fresh.targets.map(ref => [ref.key, ref]));
  requireThat(targets.size === manifest.targets.length && manifest.targets.every(ref => {
    const current = targets.get(ref.key);
    return current && current.reference === ref.reference && current.provider === ref.provider;
  }), 'Target inventory changed or manifest was modified');
  const rows = new Map(state.rows.map(row => [row.reference_key, row]));
  const scopeGuard = `(SELECT COUNT(*) FROM certificates WHERE is_current=1)=${state.certificates.length} AND ` + state.certificates.map(cert =>
    `EXISTS(SELECT 1 FROM certificates WHERE id=${Number(cert.id)} AND cert_type=${q(cert.cert_type)} AND source_hash=${q(cert.source_hash)} AND is_current=1)`).join(' AND ');
  // target_count is NOT NULL: scope changes after the preflight abort the entire atomic import.
  const sql = [`INSERT INTO publisher_review_runs(run_id,started_at,completed_at,target_count,runner,report_hash) VALUES (${q(manifest.run_id)},${q(manifest.started_at)},${q(now)},CASE WHEN ${scopeGuard} THEN ${targets.size} ELSE NULL END,${q(input.runner)},${q(await digest(input))});`];
  const summary = { changed: 0, unchanged: 0, unverified: 0, conflict: 0 };
  for (const result of results) {
    const target = targets.get(result.key), expected = manifest.targets.find(ref => ref.key === result.key);
    const row = rows.get(result.key) || null;
    let outcome = result.outcome === 'verified' ? 'unchanged' : 'unverified';
    if (target.expected_hash !== expected.expected_hash) outcome = 'conflict';
    const oldSet = publishedSet(effectiveRecord(row)), newSet = publishedSet(result.record);
    if (outcome === 'unchanged' && asJson(oldSet) !== asJson(newSet)) outcome = 'changed';
    summary[outcome]++;
    // Protect against writes arriving after the fresh read, including manual/API refreshes.
    const guard = row
      ? `EXISTS(SELECT 1 FROM publisher_catalog WHERE reference_key=${q(result.key)} AND auto_json IS ${q(row.auto_json)} AND manual_json IS ${q(row.manual_json)} AND checked_at IS ${q(row.checked_at)} AND attempted_at IS ${q(row.attempted_at)})`
      : `NOT EXISTS(SELECT 1 FROM publisher_catalog WHERE reference_key=${q(result.key)})`;
    const effectiveOutcome = ['changed','unchanged'].includes(outcome) ? `CASE WHEN ${guard} THEN ${q(outcome)} ELSE 'conflict' END` : q(outcome);
    sql.push(`INSERT INTO publisher_review_results(run_id,reference_key,outcome,reason,evidence_json,checked_at) VALUES (${q(manifest.run_id)},${q(result.key)},${effectiveOutcome},${q(result.note)},${q(asJson(result.evidence))},${q(result.record?.checked_at)});`);
    if (!['changed','unchanged'].includes(outcome)) continue;
    const permitted = `EXISTS(SELECT 1 FROM publisher_review_results WHERE run_id=${q(manifest.run_id)} AND reference_key=${q(result.key)} AND outcome IN ('changed','unchanged'))`;
    const payload = asJson(result.record);
    if (outcome === 'changed') sql.push(`INSERT INTO publisher_changes(run_id,reference_key,designation,before_json,after_json,source_url,detected_at) SELECT ${q(manifest.run_id)},${q(result.key)},${q(target.reference)},${q(asJson(oldSet))},${q(asJson(newSet))},${q(result.record.source_url)},${q(now)} WHERE ${permitted};`);
    sql.push(`INSERT INTO publisher_catalog(reference_key,designation,provider,manual_json,source_url,checked_at,attempted_at,error,next_check_at)
      SELECT ${q(result.key)},${q(target.reference)},${q(target.provider)},${q(payload)},${q(result.record.source_url)},${q(result.record.checked_at)},${q(now)},NULL,${q(new Date(Date.parse(now)+7*DAY).toISOString())} WHERE ${permitted}
      ON CONFLICT(reference_key) DO UPDATE SET designation=excluded.designation,provider=excluded.provider,manual_json=excluded.manual_json,source_url=excluded.source_url,checked_at=excluded.checked_at,attempted_at=excluded.attempted_at,error=NULL,next_check_at=excluded.next_check_at;`);
    // Unchanged checks have run evidence, but do not flood edition history or extend the banner.
    if (outcome === 'changed') sql.push(`INSERT INTO publisher_catalog_history(reference_key,origin,payload_json,recorded_at) SELECT ${q(result.key)},'manual',${q(payload)},${q(now)} WHERE ${permitted};`);
  }
  requireThat(sql.every(statement => new TextEncoder().encode(statement).length < 90000), 'D1 statement size limit: shorten evidence without dropping edition coverage');
  return { sql: sql.join('\n') + '\n', summary };
}

export async function recentPublisherChanges(db, now = new Date().toISOString(), days = PUBLISHED_BANNER_DAYS) {
  requireThat(Number.isInteger(days) && days > 0 && days <= 90, 'Invalid banner duration');
  const since = new Date(Date.parse(now) - days * DAY).toISOString();
  const { results } = await db.prepare('SELECT * FROM publisher_changes WHERE detected_at>?1 AND detected_at<=?2 ORDER BY detected_at DESC,id DESC').bind(since, now).all();
  return { banner_days: days, items: results.map(row => ({ id: row.id, key: row.reference_key, designation: row.designation,
    before: JSON.parse(row.before_json), after: JSON.parse(row.after_json), source_url: row.source_url,
    detected_at: row.detected_at, expires_at: new Date(Date.parse(row.detected_at) + days * DAY).toISOString() })) };
}
