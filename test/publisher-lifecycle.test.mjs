import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createManifest, readReviewState, validateReport, buildReviewSql, publisherState, recentPublisherChanges } from '../src/lib/publisher-review.js';
import { validateManual, loadCatalog, withSearchLinks } from '../src/lib/catalog.js';
import { checkPublished, buildScopeOjVersionCheck } from '../src/lib/scope-oj.js';
import { parseStandardReferences } from '../src/lib/references.js';
import app from '../src/index.js';
import { env } from './helpers.mjs';

const START = '2026-09-13T00:00:00.000Z', CHECK = '2026-09-13T00:10:00.000Z', NOW = '2026-09-13T01:00:00.000Z';
const source = 'https://standards.cencenelec.eu/withdrawal-test';
const ref = value => parseStandardReferences(value)[0];
const migration = name => readFileSync(new URL('../migrations/' + name, import.meta.url), 'utf8');
function database(v2 = true) {
  const sqlite = new DatabaseSync(':memory:');
  for (const name of ['0001_init.sql','0002_publisher_catalog.sql','0003_publisher_reviews.sql']) sqlite.exec(migration(name));
  if (v2) sqlite.exec(migration('0004_publisher_lifecycle.sql'));
  sqlite.exec(`INSERT INTO certificates(id,cert_type,certificate_number,source_file,source_hash,imported_at) VALUES (1,'jab','fixture','fixture.md','hash','2026-09-12');
    INSERT INTO scope_items(certificate_id,standard,anchor) VALUES (1,'EN 55022:2010','#scope');`);
  const db = { sqlite, prepare(sql) {
    const statement = sqlite.prepare(sql); let params = {};
    return { bind(...values) { params = Object.fromEntries(values.map((value, index) => [String(index + 1), value])); return this; },
      async all() { return { results: statement.all(params) }; }, async first() { return statement.get(params) || null; },
      async run() { return { meta: { changes: Number(statement.run(params).changes) } }; } };
  }, async batch(statements) {
    sqlite.exec('BEGIN'); try { const result = await Promise.all(statements.map(s => s.run())); sqlite.exec('COMMIT'); return result; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } };
  return db;
}
function report(manifest, replacementStatus = 'known') {
  return { schema_version: 2, run_id: manifest.run_id, runner: 'test-fixture', results: manifest.targets.map(target => ({
    key: target.key, expected_hash: target.expected_hash, outcome: 'verified', source_reference: target.reference,
    checked_at: CHECK, coverage: 'current_published_set', no_current_published: true, note: 'Synthetic withdrawal verification',
    evidence: [{ url: source, title: 'Synthetic official withdrawal page', finding: 'Reference withdrawn and successor relationship explicit', retrieved_at: CHECK }],
    editions: [{ edition: '2010', status: 'withdrawn', source_url: source, publication_date: null }],
    lifecycle: { status: 'withdrawn', withdrawal_confirmed: true, withdrawal_date: '2017-03-05', source_url: source,
      replacement_status: replacementStatus, replacements: replacementStatus === 'known' ? [
        { reference: 'EN 55032:2015', relation: 'partial', note: 'Synthetic multimedia coverage', source_url: source },
        { reference: 'EN 50561-1:2013', relation: 'partial', note: 'Synthetic power-line coverage', source_url: source },
      ] : [] },
  })) };
}
const execute = (db, sql) => { db.sqlite.exec('BEGIN'); try { db.sqlite.exec(sql); db.sqlite.exec('COMMIT'); } catch (error) { db.sqlite.exec('ROLLBACK'); throw error; } };

test('withdrawn reference is distinct from unknown, including confirmed none and unverified successor', async () => {
  const db = database();
  try {
    const manifest = await createManifest(await readReviewState(db), START);
    for (const status of ['known','none','unknown']) {
      const record = validateReport(manifest, report(manifest, status), NOW)[0].record;
      const check = checkPublished(ref('EN 55022'), record, '2026-09-13');
      assert.equal(check.status, 'withdrawn'); assert.equal(check.reason, 'publisher_withdrawn_' + status);
      assert.equal(checkPublished(ref('EN 55022'), { ...record, error: 'offline' }, '2026-09-13').status, 'withdrawn');
      assert.equal(checkPublished(ref('EN 55022'), { ...record, checked_at: null }, '2026-09-13').status, 'unverified');
      assert.equal(checkPublished(ref('EN 55022'), { ...record, review_schema_version: undefined }, '2026-09-13').status, 'unverified');
    }
  } finally { db.sqlite.close(); }
});

test('old edition withdrawal with current edition does not mean reference withdrawal', () => {
  const record = validateManual({ reference: 'EN 55032', edition: '2015', status: 'published', source_url: source, note: 'fixture' }, CHECK);
  record.editions.unshift({ ...record.editions[0], status: 'withdrawn', edition: ref('EN 55032:2012').editions[0] });
  assert.equal(checkPublished(ref('EN 55032:2012'), record, '2026-09-13').status, 'warning');
  assert.equal(checkPublished(ref('EN 55032'), record, '2026-09-13').status, 'confirmation');
});

test('lifecycle validation rejects ambiguity, future dates, unsupported relations and unsafe links', async () => {
  const db = database();
  try {
    const manifest = await createManifest(await readReviewState(db), START);
    for (const change of [
      r => { delete r.lifecycle; }, r => { r.lifecycle.withdrawal_confirmed = false; },
      r => { r.lifecycle.withdrawal_date = '2099-01-01'; }, r => { r.lifecycle.withdrawal_date = '2026-02-30'; },
      r => { r.lifecycle.source_url = 'https://example.com'; },
      r => { r.lifecycle.replacements[0].source_url = 'javascript:alert(1)'; },
      r => { r.lifecycle.replacement_status = 'none'; }, r => { r.lifecycle.replacements = []; },
      r => { r.lifecycle.replacements[0].reference = 'EN 55022:2010'; },
      r => { r.lifecycle.replacements[0].relation = 'maybe'; }, r => { r.lifecycle.replacements[0].note = ''; },
      r => { r.lifecycle.replacements.push(r.lifecycle.replacements[0]); },
      r => { r.editions.push({ edition: '2020', status: 'published', source_url: source }); },
    ]) { const input = report(manifest); change(input.results[0]); assert.throws(() => validateReport(manifest, input, NOW)); }
    const legacy = report(manifest); legacy.schema_version = 1;
    assert.throws(() => validateReport({ ...manifest, schema_version: 1 }, legacy, NOW), /Unsupported/);
  } finally { db.sqlite.close(); }
});

test('successors use independent catalogue data and do not alter accreditation or OJ comparison', async () => {
  const db = database();
  try {
    const manifest = await createManifest(await readReviewState(db), START);
    const old = validateReport(manifest, report(manifest), NOW)[0].record;
    const successor = validateManual({ reference: 'EN 55032', edition: '2015+A1:2020', source_url: source, note: 'fixture' }, CHECK);
    const documents = [{ certType: 'jab', doc: { items: [{ standard: 'EN 55022:2010 / EN 55032:2015+A1:2020' }] } }];
    const result = buildScopeOjVersionCheck(documents, { EMC: [{ number: 'EN 55022:2010' }] }, '2026-09-13', { directive: 'EMC', catalog: [old, successor] });
    const item = result.items[0];
    assert.equal(item.status, 'valid'); assert.equal(item.published.status, 'withdrawn');
    assert.equal(item.published.partial_withdrawal, true); assert.equal(result.published_summary.withdrawn, 1);
    const replacements = item.references[0].published.replacements;
    assert.equal(replacements[0].published.latest.designation, 'EN 55032:2015+A1:2020');
    assert.equal(replacements[1].published.status, 'unverified');
    assert.equal(documents[0].doc.items[0].standard, item.standard);
    const catalog = withSearchLinks([ref('EN 55022')], [old, successor]);
    assert.equal(catalog[0].record.replacement_checks[0].published.latest.designation, successor.editions[0].designation);
  } finally { db.sqlite.close(); }
});

test('lifecycle-only and replacement-only differences create events; repeated confirmation does not extend expiry', async () => {
  const db = database();
  try {
    let state = await readReviewState(db), manifest = await createManifest(state, START);
    const scopesBefore = db.sqlite.prepare('SELECT * FROM scope_items').all();
    execute(db, (await buildReviewSql(state, manifest, report(manifest, 'unknown'), NOW)).sql);
    let feed = await recentPublisherChanges(db, NOW);
    assert.equal(feed.items[0].change_kind, 'status'); assert.deepEqual(feed.items[0].before, []); assert.deepEqual(feed.items[0].after, []);
    assert.equal(feed.items[0].after_state.status, 'withdrawn');
    state = await readReviewState(db); manifest = await createManifest(state, START);
    execute(db, (await buildReviewSql(state, manifest, report(manifest, 'unknown'), NOW)).sql);
    assert.equal((await recentPublisherChanges(db, NOW)).items.length, 1);
    state = await readReviewState(db); manifest = await createManifest(state, START);
    execute(db, (await buildReviewSql(state, manifest, report(manifest), NOW)).sql);
    feed = await recentPublisherChanges(db, NOW);
    assert.equal(feed.items.length, 2); assert.equal(feed.items[0].change_kind, 'replacement');
    assert.equal(feed.items[0].after_state.replacements.length, 2);
    assert.equal((await recentPublisherChanges(db, '2026-09-20T01:00:00.000Z')).items.length, 0);
    const record = (await loadCatalog({env:{DB:db}})).records[0];
    const reordered = structuredClone(record); reordered.lifecycle.replacements.reverse(); reordered.checked_at = NOW;
    assert.deepEqual(publisherState(record), publisherState(reordered));
    assert.deepEqual(db.sqlite.prepare('SELECT * FROM scope_items').all(), scopesBefore);
    assert.deepEqual(db.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { db.sqlite.close(); }
});

test('failed recheck retains withdrawal and exposes the latest attempt separately', async () => {
  const db = database();
  try {
    let state = await readReviewState(db), manifest = await createManifest(state, START);
    execute(db, (await buildReviewSql(state, manifest, report(manifest), NOW)).sql);
    state = await readReviewState(db); manifest = await createManifest(state, START);
    const input = report(manifest); input.results = input.results.map(r => ({key:r.key, expected_hash:r.expected_hash, outcome:'unverified', note:'Official portal unavailable'}));
    execute(db, (await buildReviewSql(state, manifest, input, '2026-09-13T02:00:00.000Z')).sql);
    assert.deepEqual((await readReviewState(db)).rows, state.rows);
    const record = (await loadCatalog({env:{DB:db}})).records[0];
    assert.equal(record.latest_review.outcome, 'unverified'); assert.equal(record.checked_at, CHECK);
    assert.equal(checkPublished(ref('EN 55022'), record, '2026-09-13').status, 'withdrawn');
  } finally { db.sqlite.close(); }
});

test('migration preserves old data and legacy notices, while rejecting already-generated v1 SQL', async () => {
  const db = database(false);
  try {
    const legacy = { ...validateManual({reference:'EN 55022',edition:'2010',source_url:source,note:'legacy'},CHECK),verification_method:'scheduled_review'};
    db.sqlite.prepare('INSERT INTO publisher_catalog(reference_key,designation,provider,manual_json) VALUES (?,?,?,?)').run(legacy.key,legacy.designation,legacy.provider,JSON.stringify(legacy));
    const before = db.sqlite.prepare('SELECT * FROM publisher_catalog').all();
    db.sqlite.prepare('INSERT INTO publisher_review_runs VALUES (?,?,?,?,?,?)').run('legacy-run',START,NOW,1,'legacy','hash');
    db.sqlite.prepare('INSERT INTO publisher_changes(run_id,reference_key,designation,before_json,after_json,source_url,detected_at) VALUES (?,?,?,?,?,?,?)').run('legacy-run',legacy.key,legacy.designation,'["2006"]','["2010"]',source,NOW);
    db.sqlite.exec(migration('0004_publisher_lifecycle.sql'));
    assert.deepEqual(db.sqlite.prepare('SELECT * FROM publisher_catalog').all(),before);
    const notice=(await recentPublisherChanges(db,NOW)).items[0];
    assert.deepEqual(notice.before,['2006']); assert.deepEqual(notice.after,['2010']);
    assert.equal(notice.after_state,null); assert.equal(notice.change_kind,'edition');
    const update = db.sqlite.prepare('UPDATE publisher_catalog SET manual_json=? WHERE reference_key=?');
    assert.throws(()=>update.run(JSON.stringify({...legacy,note:'old writer'}),legacy.key),/schema v2/);
    assert.throws(()=>db.sqlite.prepare('INSERT INTO publisher_catalog(reference_key,designation,provider,manual_json) VALUES (?,?,?,?)').run('EN:55024','EN 55024','cenelec',JSON.stringify(legacy)),/schema v2/);
    assert.deepEqual(db.sqlite.prepare('SELECT * FROM publisher_catalog').all(),before);
  } finally { db.sqlite.close(); }
});

test('manual edit and clear cannot erase confirmed withdrawal metadata', async () => {
  const db = database();
  try {
    const state = await readReviewState(db), manifest = await createManifest(state, START);
    execute(db, (await buildReviewSql(state, manifest, report(manifest), NOW)).sql);
    const rows = db.sqlite.prepare('SELECT * FROM publisher_catalog').all();
    const request = (path, body) => app.request('/api/catalog/' + path, {method:'POST',headers:{Authorization:'Bearer local-test-key','Content-Type':'application/json'},body:JSON.stringify(body)}, {...env,DB:db,CATALOG_ADMIN_TOKEN:'local-test-key'});
    assert.equal((await request('manual',{reference:'EN 55022',edition:'2010',source_url:source,note:'legacy form'})).status,409);
    assert.equal((await request('clear-manual',{key:'EN:55022'})).status,409);
    assert.throws(()=>db.sqlite.exec("UPDATE publisher_catalog SET manual_json=NULL"),/lifecycle review/);
    assert.deepEqual(db.sqlite.prepare('SELECT * FROM publisher_catalog').all(),rows);
  } finally { db.sqlite.close(); }
});

test('targeted bootstrap keeps unselected records out of the review and preserves compare-and-swap', async () => {
  const db = database();
  try {
    db.sqlite.exec("INSERT INTO scope_items(certificate_id,standard,anchor) VALUES (1,'EN 55024:2010','#second')");
    const state = await readReviewState(db), manifest = await createManifest(state,START,crypto.randomUUID(),['EN:55022']);
    assert.equal(manifest.targets.length,1);
    execute(db,(await buildReviewSql(state,manifest,report(manifest),NOW)).sql);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM publisher_review_results').get().n,1);
    await assert.rejects(createManifest(state,START,crypto.randomUUID(),['EN:bad']),/Unknown/);
    await assert.rejects(createManifest(state,START,crypto.randomUUID(),['EN:55022','EN:55022']),/duplicate/);
  } finally { db.sqlite.close(); }
});

test('a contract change after preflight aborts the complete atomic import',async()=>{
  const db=database();
  try{
    const state=await readReviewState(db),manifest=await createManifest(state,START);
    const plan=await buildReviewSql(state,manifest,report(manifest),NOW);
    db.sqlite.exec('UPDATE publisher_review_contract SET min_schema_version=3');
    assert.throws(()=>execute(db,plan.sql),/NOT NULL/);
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM publisher_review_runs').get().n,0);
    assert.deepEqual(db.sqlite.prepare('SELECT * FROM publisher_catalog').all(),state.rows);
  }finally{db.sqlite.close();}
});
