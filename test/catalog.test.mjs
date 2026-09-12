import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import app from '../src/index.js';
import { env } from './helpers.mjs';
import { validateManual, loadCatalog, syncCatalog } from '../src/lib/catalog.js';
import { clearScopeCache, loadScopeDocument } from '../src/lib/scopes.js';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of ['0001_init.sql', '0002_publisher_catalog.sql']) sqlite.exec(readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8'));
  return {
    sqlite,
    prepare(sql) {
      const stmt = sqlite.prepare(sql);
      let values = {};
      return { bind(...args) { values = Object.fromEntries(args.map((v, i) => [String(i + 1), v])); return this; },
        async all() { return { results: stmt.all(values) }; }, async first() { return stmt.get(values) || null; },
        async run() { return { meta: { changes: Number(stmt.run(values).changes) } }; } };
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try { const r = await Promise.all(statements.map(s => s.run())); sqlite.exec('COMMIT'); return r; }
      catch (e) { sqlite.exec('ROLLBACK'); throw e; }
    },
  };
}
const payload = { reference: 'IEC 61326-1', edition: '2020', source_url: 'https://webstore.iec.ch/en/publication/62793', note: 'Verified in official catalogue', status: 'published' };
const call = (bindings, path, body, token) => app.request('/api/catalog' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) }, bindings);

test('manual validation rejects partial edition parsing and invalid evidence', () => {
  assert.equal(validateManual(payload).editions[0].edition.base, '2020');
  for (const override of [{ edition: '2020/2021' }, { edition: '2020 garbage' }, { edition: 'latest' }, { source_url: 'https://example.com' }, { note: '' }, { publication_date: '2026-02-30' }, { publication_date: '2099-01-01' }, { reference: 'IEC 61326-1:2020' }]) assert.throws(() => validateManual({ ...payload, ...override }));
});
test('catalogue reads work without migration but all writes require a secret', async () => {
  assert.equal((await app.request('/api/catalog', {}, env)).status, 200);
  assert.equal((await call(env, '/manual', payload)).status, 401);
  assert.equal((await call({ ...env, CATALOG_ADMIN_TOKEN: 'secret' }, '/manual', payload, 'wrong')).status, 401);
  const spoof = await app.request('/api/catalog/manual', { method: 'POST', headers: { 'Cf-Access-Authenticated-User-Email': 'admin@example.com' }, body: JSON.stringify(payload) }, env);
  assert.equal(spoof.status, 401);
});
test('SQLite migration, manual override, history and clear preserve auto data', async () => {
  const DB = database(), bindings = { ...env, DB, CATALOG_ADMIN_TOKEN: 'local-test-key' }, c = { env: bindings };
  try {
    const manual = await call(bindings, '/manual', payload, 'local-test-key');
    assert.equal(manual.status, 200, await manual.text());
    const auto = { ...validateManual(payload), origin: 'automatic', note: undefined };
    await DB.prepare('UPDATE publisher_catalog SET auto_json=?1,error=?2 WHERE reference_key=?3').bind(JSON.stringify(auto), 'HTTP 503', auto.key).run();
    let r = (await loadCatalog(c)).records[0];
    assert.equal(r.origin, 'manual'); assert.equal(r.error, null); assert.equal(r.automatic_error, 'HTTP 503');
    assert.equal((await call(bindings, '/clear-manual', { key: auto.key }, 'local-test-key')).status, 200);
    r = (await loadCatalog(c)).records[0];
    assert.equal(r.origin, 'automatic'); assert.equal(r.error, 'HTTP 503');
    const h = await (await app.request('/api/catalog/history?key=' + auto.key, {}, bindings)).json();
    assert.deepEqual(h.data.map(v => v.origin), ['clear_manual', 'manual']);
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM certificates').get().n, 0);
  } finally { DB.sqlite.close(); }
});
test('refresh retains last success after network failure, releases lock, and honors batch limit', async t => {
  const DB = database(), c = { env: { ...env, DB }, req: { url: 'https://local.test/' } };
  clearScopeCache();
  try {
    t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify([{ ETSI_DELIVERABLE: 'EN 300 328 V2.2.2', ACTION_TYPE: 'PU', IsCurrent: 1, superseded: 0, total_count: 1, EDSpathname: 'sample/', EDSPDFfilename: 'sample.pdf' }])));
    const first = await syncCatalog(c, { keys: ['EN:300328'], force: true, limit: 1 });
    assert.equal(first.processed, 1); assert.equal(first.results[0].success, true);
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
    const failed = await syncCatalog(c, { keys: ['EN:300328'], force: true, limit: 1 });
    assert.equal(failed.results[0].success, false);
    const r = (await loadCatalog(c)).records.find(r => r.key === 'EN:300328');
    assert.equal(r.editions[0].edition.base, 'V2.2.2'); assert.equal(r.error, 'offline');
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM publisher_sync_lock').get().n, 0);
    assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM certificates').get().n, 0);
    await DB.prepare('INSERT INTO publisher_sync_lock VALUES (1,?1,?2)').bind('another-run', '2099-01-01').run();
    assert.equal((await syncCatalog(c)).busy, true);
  } finally { clearScopeCache(); DB.sqlite.close(); }
});
test('refresh input is bounded and force requires explicit references', async () => {
  const bindings = { ...env, CATALOG_ADMIN_TOKEN: 'key' };
  assert.equal((await call(bindings, '/refresh', { force: true }, 'key')).status, 400);
  assert.equal((await call(bindings, '/refresh', { keys: Array(11).fill('EN:1') }, 'key')).status, 400);
  assert.equal((await app.request('/api/scope-oj-version-check?directive=wrong', {}, env)).status, 400);
});

test('catalogue writes leave existing current D1 accreditation data intact', async () => {
  const DB = database(), bindings = { ...env, DB, CATALOG_ADMIN_TOKEN: 'key' };
  clearScopeCache();
  try {
    DB.sqlite.exec(`INSERT INTO certificates(id,cert_type,certificate_number,source_file,source_hash,imported_at) VALUES (1,'jab','TEST-JAB','test.md','hash','2026-09-12');
      INSERT INTO facilities(id,certificate_id,facility_number,name) VALUES (1,1,'2','Test laboratory');
      INSERT INTO scope_items(certificate_id,facility_id,standard,anchor) VALUES (1,1,'EN 61326-1:2012/2013','#scope-test');`);
    const before = JSON.stringify(DB.sqlite.prepare('SELECT * FROM scope_items').all());
    assert.equal((await call(bindings, '/manual', payload, 'key')).status, 200);
    const doc = await loadScopeDocument({ env: bindings, req: { url: 'https://local.test/' } }, 'jab', { noCache: true });
    assert.equal(doc.source, 'd1'); assert.equal(doc.doc.items.length, 1);
    assert.equal(doc.doc.items[0].standard, 'EN 61326-1:2012/2013');
    const cards = await (await app.request('/api/accreditations', {}, bindings)).json();
    const jab = cards.data.items.find(item => item.cert_type === 'jab');
    assert.equal(jab.source, 'd1');
    assert.equal(jab.certificate_number, 'TEST-JAB');
    assert.equal(jab.item_count, 1);
    assert.equal(JSON.stringify(DB.sqlite.prepare('SELECT * FROM scope_items').all()), before);
  } finally { clearScopeCache(); DB.sqlite.close(); }
});
