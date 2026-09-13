import { test } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';
import { env } from './helpers.mjs';
import { clearScopeCache } from '../src/lib/scopes.js';

// EC への到達は環境依存なので、テスト中は外部 fetch を必ず失敗させて同梱 Excel のパスを通す
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = typeof url === 'string' ? url : url.url;
  if (/europa\.eu/.test(u)) throw new Error('offline in tests');
  return realFetch(url, init);
};

const get = (path) => app.request(path, {}, env);
const post = (path, body) => app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, env);

test('GET /api/health', async () => {
  const r = await get('/api/health');
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.data.runtime, 'cloudflare-workers');
});

test('GET /data/SCOPE_FORMAT.md serves Markdown with an explicit UTF-8 charset', async () => {
  const r = await get('/data/SCOPE_FORMAT.md');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type') || '', /text\/markdown;\s*charset=utf-8/i);
  assert.match(await r.text(), /スコープ/);
});

test('GET /api/directives (and legacy /.netlify/functions path)', async () => {
  for (const p of ['/api/directives', '/.netlify/functions/directives']) {
    const r = await get(p);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.success, true);
    assert.deepEqual(j.data.map(d => d.code).sort(), ['EMC', 'LVD', 'RED']);
  }
});

test('GET /api/standards falls back to bundled xlsx when EC is unreachable', async () => {
  const r = await get('/api/standards?directive=EMC');
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.success, true);
  assert.equal(j.data.directive, 'EMC');
  assert.ok(j.data.count > 150);
  assert.equal(j.data.source, 'bundled');
  assert.ok(j.data.standards[0].number.includes('EN'));
  const bad = await get('/api/standards?directive=XYZ');
  assert.equal(bad.status, 400);
});

test('GET /api/certificate-data (MD fallback, no D1)', async () => {
  const r = await get('/api/certificate-data?cert_type=jab');
  const j = await r.json();
  assert.equal(j.success, true);
  assert.equal(j.data.certificate_type, 'JAB_MD_Dynamic');
  assert.equal(j.data.total_standards, 1051);
  assert.equal(j.data.facilities.length, 2);
  assert.equal(j.data.source, 'md');
  const a = await (await get('/api/certificate-data?cert_type=a2la')).json();
  assert.equal(a.data.total_standards, 88);
  assert.equal(a.data.certificate_info.certificate_number, '7080.01');
  assert.equal((await get('/api/certificate-data?cert_type=x')).status, 400);
});

test('GET /api/accreditations returns compact current metadata and PDF links without scope lists', async () => {
  const response = await get('/api/accreditations');
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.deepEqual(data.items.map(item => item.cert_type), ['a2la', 'jab']);
  assert.deepEqual(data.items.map(item => item.item_count), [88, 1051]);
  for (const item of data.items) {
    assert.equal(item.available, true);
    assert.equal(item.source, 'md');
    assert.ok(item.certificate_number && item.valid_until && item.organization);
    assert.equal(item.pdf_url, `/certificates/${item.cert_type}.pdf`);
    assert.equal('test_standards' in item, false);
  }
});

test('accreditation metadata failure is isolated to the affected card and can be retried', async () => {
  clearScopeCache();
  const broken = { ...env, ASSETS: { async fetch(request) {
    if (new URL(request.url).pathname.endsWith('/jab-scopes.md')) return new Response('unavailable', { status: 503 });
    return env.ASSETS.fetch(request);
  } } };
  try {
    const { data } = await (await app.request('/api/accreditations', {}, broken)).json();
    assert.equal(data.items[0].available, true);
    assert.equal(data.items[1].available, false);
    assert.equal(data.items[1].certificate_number, undefined);
    assert.equal(data.items[1].pdf_url, '/certificates/jab.pdf');
    const retried = await (await get('/api/accreditations')).json();
    assert.ok(retried.data.items.every(item => item.available));
  } finally { clearScopeCache(); }
});

test('GET /api/scope-oj-version-check compares every current scope item', async () => {
  const r = await get('/api/scope-oj-version-check');
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.success, true);
  assert.equal(j.data.items.length, 1051 + 88);
  assert.equal(j.data.summary.total, j.data.items.length);
  assert.ok(j.data.summary.valid + j.data.summary.warning + j.data.summary.caution + j.data.summary.confirmation + j.data.summary.not_listed + j.data.summary.unverified + j.data.summary.withdrawn === j.data.items.length);
  assert.equal(j.data.sources.scopes.jab.source, 'md');
  assert.equal(j.data.sources.oj.EMC.source, 'bundled');
  assert.equal(j.data.sources.oj.EMC.source_updated_at, '2022-09-16T14:37:07.000Z');
  assert.equal(j.data.sources.oj.EMC.source_updated_kind, 'xlsx_modified');
  const missingScopeVersion = j.data.items.find(item => item.standard === 'EN 55011');
  assert.equal(missingScopeVersion.status, 'confirmation');
  assert.equal(missingScopeVersion.reason, 'scope_version_missing');
});

test('POST /api/scope-matcher keeps the legacy response shape', async () => {
  const r = await post('/api/scope-matcher', { oj_standards: ['EN 55032:2015', 'EN 301 489-52 V1.2.1', 'EN 99999'] });
  const j = await r.json();
  assert.equal(j.success, true);
  assert.equal(j.data.total_standards, 3);
  assert.equal(j.data.matches[0].scope_matches.jab.status, 'version_tolerant_match');
  assert.equal(j.data.matches[1].scope_matches.a2la.status, 'comprehensive_match');
  assert.equal(j.data.matches[2].scope_matches.jab.status, 'no_match');
  assert.equal(j.data.jab_matches, 2);
});

test('POST /api/scope-search', async () => {
  const j = await (await post('/api/scope-search', { search_query: '55032' })).json();
  assert.equal(j.success, true);
  assert.ok(j.data.total_matches > 0);
  assert.ok(j.data.jab_matches.every(m => 'anchor' in m && 'match_type' in m));
});

test('GET /api/search?q=', async () => {
  const j = await (await get('/api/search?q=55032')).json();
  assert.equal(j.success, true);
  assert.ok(j.data.count > 0);
  assert.ok(j.data.results.every(r => r.directive));
});

test('POST /api/compare and /api/batch-compare', async () => {
  const iso = [{ standard_number: 'EN 55032' }, { standard_number: 'EN 99999' }];
  const c1 = await (await post('/api/compare', { directive: 'EMC', iso_standards: iso })).json();
  assert.equal(c1.success, true);
  assert.ok(c1.data.matched_count >= 1);                       // EMC には EN 55032 の年版違いが複数載る
  assert.deepEqual(c1.data.iso_only_standards, [{ standard_number: 'EN 99999' }]);
  const b = await (await post('/api/batch-compare', { iso_standards: iso })).json();
  assert.equal(b.success, true);
  assert.ok(['EMC', 'RED', 'LVD'].every(d => d in b.data.results));
});

test('POST /api/quick-check', async () => {
  const j = await (await post('/api/quick-check', { text: 'EN 55032:2015\nEN 301 489-17 V3.2.4\nEN 55022:2016, EN 62311:2020\n\nEN 300 328 V2.2.2' })).json();
  assert.equal(j.success, true);
  assert.equal(j.data.input_count, 5);
  const by = Object.fromEntries(j.data.items.map(i => [i.input, i]));
  assert.equal(by['EN 55032:2015'].verdict, 'ok');
  assert.equal(by['EN 55032:2015'].oj_status, 'harmonised');
  assert.ok(by['EN 55032:2015'].oj.some(o => o.directive === 'EMC'));
  assert.equal(by['EN 55022:2016'].verdict, 'check');
  assert.equal(by['EN 62311:2020'].verdict, 'ng');
  assert.equal(by['EN 300 328 V2.2.2'].a2la.verdict, 'ok');
  assert.equal(by['EN 300 328 V2.2.2'].jab.verdict, 'ng');
  assert.equal(j.data.summary.ok + j.data.summary.check + j.data.summary.ng, 5);
  assert.equal(j.data.sources.jab.certificate_number, 'RTL02770');
  const empty = await post('/api/quick-check', { text: '' });
  assert.equal(empty.status, 400);
});

test('GET /api/me without Access header', async () => {
  const j = await (await get('/api/me')).json();
  assert.equal(j.data.email, null);
  const r2 = await app.request('/api/me', { headers: { 'Cf-Access-Authenticated-User-Email': 'x@sgs.com' } }, env);
  assert.equal((await r2.json()).data.email, 'x@sgs.com');
});

test('unknown API path → 404 JSON', async () => {
  const r = await get('/api/nope');
  assert.equal(r.status, 404);
  assert.equal((await r.json()).success, false);
});
