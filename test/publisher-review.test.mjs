import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createManifest, readReviewState, validateReport, buildReviewSql, publishedSet, recentPublisherChanges, providerSource, REVIEW_SCHEMA } from '../src/lib/publisher-review.js';
import { validateManual, loadCatalog } from '../src/lib/catalog.js';
import app from '../src/index.js';
import { env } from './helpers.mjs';

const START = '2026-09-13T00:00:00.000Z', CHECK = '2026-09-13T00:10:00.000Z', NOW = '2026-09-13T01:00:00.000Z';
const source = 'https://webstore.iec.ch/en/publication/test';
function database() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of ['0001_init.sql','0002_publisher_catalog.sql','0003_publisher_reviews.sql','0004_publisher_lifecycle.sql']) sqlite.exec(readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8'));
  const db = { sqlite, prepare(sql) {
    const statement = sqlite.prepare(sql); let params = {};
    return { bind(...values) { params = Object.fromEntries(values.map((v, i) => [String(i + 1), v])); return this; },
      async all() { return { results: statement.all(params) }; }, async first() { return statement.get(params) || null; },
      async run() { return { meta: { changes: Number(statement.run(params).changes) } }; } };
  } };
  sqlite.exec(`INSERT INTO certificates(id,cert_type,certificate_number,source_file,source_hash,imported_at) VALUES (1,'jab','test','test.md','hash','2026-09-12');
    INSERT INTO scope_items(certificate_id,standard,anchor) VALUES (1,'IEC 61326-1:2020','#scope'),(1,'IEC 61326-1:2013','#other'),(1,'Wi-Fi CERTIFIED Test Plan','#wifi');`);
  const old = validateManual({ reference: 'IEC 61326-1', edition: '2020', source_url: source, note: 'Previous evidence', status: 'published' }, '2026-09-12T01:00:00.000Z');
  sqlite.prepare('INSERT INTO publisher_catalog(reference_key,designation,provider,manual_json) VALUES (?,?,?,?)').run(old.key, old.designation, old.provider, JSON.stringify(old));
  return db;
}
function report(manifest, edition = '2024') {
  return { schema_version: REVIEW_SCHEMA, run_id: manifest.run_id, runner: 'test-executor', results: manifest.targets.map(target => ({
    key: target.key, expected_hash: target.expected_hash, outcome: 'verified', checked_at: CHECK, coverage: 'current_published_set',
    source_reference: target.reference,
    note: 'Confirmed current catalogue and full edition status list',
    evidence: [{ url: source, title: 'Official current publication record', finding: 'Published edition verified', retrieved_at: CHECK }],
    editions: [{ edition, status: 'published', publication_date: null, source_url: source }],
  })) };
}
const execute = (db, sql) => { db.sqlite.exec('BEGIN'); try { db.sqlite.exec(sql); db.sqlite.exec('COMMIT'); } catch (error) { db.sqlite.exec('ROLLBACK'); throw error; } };
const count = (db, table) => db.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

test('D1-only manifest deduplicates current references and exposes unparsed scopes', async () => {
  const db = database();
  try {
    const state = await readReviewState(db), manifest = await createManifest(state, START);
    assert.equal(manifest.targets.length, 1);
    assert.equal(manifest.targets[0].scope_count, 2);
    assert.deepEqual(manifest.unresolved_scope_strings, ['Wi-Fi CERTIFIED Test Plan']);
    db.sqlite.exec('UPDATE certificates SET is_current=0');
    await assert.rejects(readReviewState(db), /MD fallback/);
  } finally { db.sqlite.close(); }
});

test('verified change writes one history/event, preserves scope and exposes 7-day notification', async () => {
  const db = database();
  try {
    const state = await readReviewState(db), manifest = await createManifest(state, START);
    const beforeScopes = JSON.stringify(db.sqlite.prepare('SELECT * FROM scope_items').all());
    const plan = await buildReviewSql(state, manifest, report(manifest), NOW);
    assert.equal(plan.summary.changed, 1);
    execute(db, plan.sql);
    assert.equal(count(db, 'publisher_changes'), 1);
    assert.equal(count(db, 'publisher_catalog_history'), 1);
    const record = (await loadCatalog({ env: { DB: db } })).records[0];
    assert.equal(record.origin, 'review');
    assert.equal(record.checked_at, CHECK);
    assert.deepEqual(publishedSet(record), ['2024']);
    assert.equal(JSON.stringify(db.sqlite.prepare('SELECT * FROM scope_items').all()), beforeScopes);
    assert.equal(count(db, 'certificates'), 1);
    assert.deepEqual(db.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal((await recentPublisherChanges(db, NOW)).items.length, 1);
    assert.equal((await recentPublisherChanges(db, '2026-09-20T00:59:59.999Z')).items.length, 1);
    assert.equal((await recentPublisherChanges(db, '2026-09-20T01:00:00.000Z')).items.length, 0);
    assert.equal((await recentPublisherChanges(db, START)).items.length, 0);
    assert.throws(() => execute(db, plan.sql), /UNIQUE/);
    assert.equal(count(db, 'publisher_changes'), 1);
  } finally { db.sqlite.close(); }
});

test('unchanged editions only refresh confirmation metadata, not edition history or notification', async () => {
  const db = database();
  try {
    const state = await readReviewState(db), manifest = await createManifest(state, START);
    const result = report(manifest, '2020');
    result.results[0].editions.push({ edition: '2026', status: 'draft', source_url: source });
    execute(db, (await buildReviewSql(state, manifest, result, NOW)).sql);
    assert.equal(count(db, 'publisher_changes'), 0);
    assert.equal(count(db, 'publisher_catalog_history'), 0);
    assert.equal(db.sqlite.prepare('SELECT outcome FROM publisher_review_results').get().outcome, 'unchanged');
    assert.equal((await loadCatalog({ env: { DB: db } })).records[0].checked_at, CHECK);
  } finally { db.sqlite.close(); }
});

test('failed or unverified evidence retains all last known catalogue data', async () => {
  const db = database();
  try {
    const state = await readReviewState(db), manifest = await createManifest(state, START);
    const result = report(manifest);
    result.results[0] = { key: manifest.targets[0].key, expected_hash: manifest.targets[0].expected_hash, outcome: 'unverified', note: 'Official portal unavailable' };
    execute(db, (await buildReviewSql(state, manifest, result, NOW)).sql);
    assert.deepEqual(db.sqlite.prepare('SELECT * FROM publisher_catalog ORDER BY reference_key').all(), state.rows);
    assert.equal(count(db, 'publisher_changes'), 0);
    assert.equal(db.sqlite.prepare('SELECT outcome FROM publisher_review_results').get().outcome, 'unverified');
  } finally { db.sqlite.close(); }
});

test('both preflight and post-preflight concurrent edits are protected from overwrite', async () => {
  for (const afterPreflight of [false, true]) {
    const db = database();
    try {
      const state = await readReviewState(db), manifest = await createManifest(state, START);
      let plan;
      if (afterPreflight) plan = await buildReviewSql(state, manifest, report(manifest), NOW);
      const newer = JSON.stringify({ ...JSON.parse(state.rows[0].manual_json), note: 'Concurrent review' });
      db.sqlite.prepare('UPDATE publisher_catalog SET manual_json=?').run(newer);
      if (!afterPreflight) plan = await buildReviewSql(await readReviewState(db), manifest, report(manifest), NOW);
      execute(db, plan.sql);
      assert.equal(db.sqlite.prepare('SELECT manual_json FROM publisher_catalog').get().manual_json, newer);
      assert.equal(db.sqlite.prepare('SELECT outcome FROM publisher_review_results').get().outcome, 'conflict');
      assert.equal(count(db, 'publisher_changes'), 0);
    } finally { db.sqlite.close(); }
  }
});

test('accreditation changes after preflight abort the whole transaction', async () => {
  const db = database();
  try {
    const state = await readReviewState(db), manifest = await createManifest(state, START);
    const plan = await buildReviewSql(state, manifest, report(manifest), NOW);
    db.sqlite.exec("UPDATE certificates SET source_hash='changed'");
    assert.throws(() => execute(db, plan.sql), /NOT NULL/);
    assert.equal(count(db, 'publisher_review_runs'), 0);
    assert.equal(count(db, 'publisher_changes'), 0);
    await assert.rejects(buildReviewSql(await readReviewState(db), manifest, report(manifest), NOW), /revisions changed/);
  } finally { db.sqlite.close(); }
});

test('new references can establish a verified baseline without changing older catalogue rows', async () => {
  const db = database();
  try {
    db.sqlite.exec('DELETE FROM publisher_catalog'); // disposable fixture only
    const state = await readReviewState(db), manifest = await createManifest(state, START);
    execute(db, (await buildReviewSql(state, manifest, report(manifest), NOW)).sql);
    assert.equal(count(db, 'publisher_catalog'), 1);
    assert.deepEqual(JSON.parse(db.sqlite.prepare('SELECT before_json FROM publisher_changes').get().before_json), []);
  } finally { db.sqlite.close(); }
});

test('research validation rejects missing targets, wrong publishers, dates, editions and draft replacement', async () => {
  const db = database();
  try {
    const manifest = await createManifest(await readReviewState(db), START);
    const mutations = [
      value => { value.results = []; }, value => { value.results.push(value.results[0]); },
      value => { value.results[0].key = 'ISO:1234'; }, value => { value.results[0].expected_hash = 'wrong'; },
      value => { value.results[0].source_reference = 'EN IEC 61326-1'; },
      value => { value.results[0].checked_at = '2026-09-12T00:00:00.000Z'; },
      value => { value.results[0].evidence[0].url = 'https://iso.org/standard/1234'; },
      value => { value.results[0].evidence[0].url = 'https://iec.ch.attacker.test/'; },
      value => { value.results[0].editions[0].edition = '2024 garbage'; },
      value => { value.results[0].editions[0].status = 'draft'; },
      value => { value.results[0].editions = []; }, value => { value.results[0].coverage = 'snippet'; },
      value => { value.results[0].evidence[0].finding = ''; },
    ];
    for (const mutate of mutations) { const value = report(manifest); mutate(value); assert.throws(() => validateReport(manifest, value, NOW)); }
    assert.equal(providerSource('https://user:password@webstore.iec.ch/', 'iec'), false);
    assert.equal(providerSource('http://webstore.iec.ch/', 'iec'), false);
    assert.throws(() => validateReport(manifest, report(manifest), '2026-09-16T00:00:00.000Z'), /expired/);
  } finally { db.sqlite.close(); }
});

test('withdrawal requires explicit evidence; semantic comparison includes amendments but ignores ordering', async () => {
  const db = database();
  try {
    const manifest = await createManifest(await readReviewState(db), START);
    const input = report(manifest, '2020'); input.results[0].editions[0].status = 'withdrawn';
    assert.throws(() => validateReport(manifest, input, NOW));
    input.results[0].no_current_published = true;
    assert.throws(() => validateReport(manifest, input, NOW), /lifecycle/);
    input.results[0].lifecycle = { status: 'withdrawn', withdrawal_confirmed: true, withdrawal_date: null,
      replacement_status: 'unknown', replacements: [], source_url: source };
    assert.equal(validateReport(manifest, input, NOW).length, 1);
    const record = { editions: [{ status: 'published', edition: { base: '2020', amendments: ['A2:2024','A1:2021'], corrections: [] } }] };
    const reordered = structuredClone(record); reordered.editions[0].edition.amendments.reverse();
    assert.deepEqual(publishedSet(record), publishedSet(reordered));
    assert.notDeepEqual(publishedSet(record), ['2020']);
  } finally { db.sqlite.close(); }
});

test('change feed is read-only and unavailable schema is reported, not a false empty success', async () => {
  assert.equal((await app.request('/api/catalog/changes', {}, env)).status, 503);
  const db = database();
  try {
    const response = await app.request('/api/catalog/changes', {}, { ...env, DB: db });
    assert.equal(response.status, 200);
    const data = (await response.json()).data;
    assert.equal(data.banner_days, 7); assert.deepEqual(data.items, []);
    assert.equal((await app.request('/api/catalog/changes', { method: 'POST' }, { ...env, DB: db })).status, 404);
  } finally { db.sqlite.close(); }
});
