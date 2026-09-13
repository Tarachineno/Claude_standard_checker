import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import * as XLSX from 'xlsx';
import { buildScopeOjVersionCheck } from '../src/lib/scope-oj.js';
import { parseStandardReferences as parse } from '../src/lib/references.js';
import { parseScopesDocument } from '../src/lib/md.js';
import { parseStandardsFromXlsx } from '../src/lib/excel.js';

function view() {
  const html = readFileSync(new URL('../static/index.html', import.meta.url), 'utf8');
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, {
    value: '', textContent: '', innerHTML: '', disabled: false, attributes: {}, listeners: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, callback) { this.listeners[name] = callback; },
  }]));
  const callbacks = [], downloads = [], successes = [], errors = [];
  const get = id => elements.get(id);
  const context = createContext({ Date, URL, console, navigator: {}, localStorage: { setItem() {} }, window: { addEventListener() {}, location: { origin: 'https://lab-scope-checker.seidaku.com' } },
    document: { getElementById: get, addEventListener(name, callback) { callbacks.push(callback); } },
    downloads, successes, errors,
  });
  const run = code => runInContext(code, context);
  for (const file of ['script.js', 'catalog.js', 'scope-export.js']) run(readFileSync(new URL('../static/' + file, import.meta.url), 'utf8'));
  callbacks.at(-1)();
  run('downloadFile=(...args)=>downloads.push(args); showSuccess=text=>successes.push(text); showError=text=>errors.push(text);');
  return { context, get, run, downloads, successes, errors };
}

function fixture() {
  const ref = parse('EN 55022:2010')[0];
  const successor = parse('EN 55032:2015')[0];
  const data = buildScopeOjVersionCheck([
    { certType: 'a2la', source: 'd1', doc: { info: { certificate_number: '7080.01' }, items: [
      { standard: 'EN 61326-1:2012/2013 / IEC 61326-1:2020', anchor: '#complex', category: 'EMC', description: '説明, "引用"\n2行目' },
    ] } },
    { certType: 'jab', source: 'd1', doc: { info: { certificate_number: 'RTL02770' }, facilities: [{ facility_number: '2', name: '横浜', location: '神奈川県' }], items: [
      { standard: 'EN 55022:2010', facility_number: '2', anchor: '#withdrawn' },
      { standard: 'Unknown test plan', description: '=HYPERLINK("https://example.org","click")' },
    ] } },
  ], {
    RED: [{ number: 'EN 61326-1:2013', title: '測定機器', restriction: 'Notice: "limited"' }],
    EMC: [{ number: 'EN 61326-1:2013' }], LVD: [{ number: 'EN 61326-1:2013' }],
  }, '2026-09-13', { catalog: [
    { key: ref.key, checked_at: '2026-09-13T00:00:00Z', review_schema_version: 2,
      editions: [{ designation: 'EN 55022:2010', edition: ref.editions[0], status: 'withdrawn' }],
      lifecycle: { status: 'withdrawn', withdrawal_confirmed: true, withdrawal_date: null, replacement_status: 'known', source_url: 'https://standards.cencenelec.eu/',
        replacements: [{ key: successor.key, reference: successor.designation, relation: 'partial', cited_edition: '2012', note: '一部のみ, "範囲"', source_url: 'https://standards.cencenelec.eu/old' }] } },
    { key: successor.key, checked_at: '2026-09-12T00:00:00Z', editions: [{ designation: 'EN 55032:2015', edition: successor.editions[0], status: 'published', source_url: 'https://standards.cencenelec.eu/new' }] },
  ] });
  data.checked_at = '2026-09-13T01:00:00Z';
  data.sources = { oj: Object.fromEntries(['RED', 'EMC', 'LVD'].map(d => [d, {
    source: 'kv', source_updated_at: '2026-09-07', source_updated_kind: 'xlsx_generated', last_checked: '2099-01-01T01:00:00Z',
  }])), catalog: { available: true } };
  return data;
}

// Parse with the same spreadsheet reader used by the app, preserving cell text.
function csvRows(csv) {
  const wb = XLSX.read(csv.replace(/^\uFEFF/, ''), { type: 'string', raw: true });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', blankrows: false });
}

test('CSV keeps every scope, compound reference, all directives, lifecycle and links in both languages', () => {
  for (const lang of ['ja', 'en']) {
    const ui = view(); ui.context.fixture = fixture();
    const csv = ui.run(`scopeComparisonCsv(fixture, '${lang}')`);
    assert.ok(csv.startsWith('\uFEFF"'));
    assert.ok(csv.endsWith('\r\n'));
    const rows = csvRows(csv);
    assert.equal(rows.length, 4);
    assert.equal(rows[0].length, 33);
    assert.ok(rows.every(row => row.length === 33));
    assert.equal(rows[0][1], lang === 'ja' ? '認可書番号' : 'Certificate number');
    assert.equal(rows[1][9], '説明, "引用"\n2行目');
    assert.ok(rows[1][10].includes('2012 / 2013'));
    for (const d of ['RED', 'EMC', 'LVD']) assert.ok(rows[1][13].includes(d));
    assert.ok(rows[1][13].includes('EN 61326-1:2013'));
    assert.ok(rows[1][15].includes('Notice: "limited"'));
    assert.ok(rows[1][16].includes('2026-09-07'));
    assert.ok(!csv.includes('2099-01-01'));
    assert.equal(rows[2][5], '横浜');
    assert.equal(rows[2][18], lang === 'ja' ? '廃止' : 'Withdrawn');
    assert.ok(rows[2][25].includes(lang === 'ja' ? '不明' : 'Unknown'));
    assert.ok(rows[2][26].includes('EN 55032') && rows[2][26].includes('2012'));
    assert.ok(rows[2][26].includes(lang === 'ja' ? '部分置換' : 'Partial replacement'));
    assert.ok(rows[2][27].includes('EN 55032:2015'));
    assert.ok(rows[2][28].includes('https://standards.cencenelec.eu/old'));
    assert.equal(rows[2][31], 'https://lab-scope-checker.seidaku.com/certificates/jab.pdf');
    assert.ok(rows[2][32].includes('anchor=%23withdrawn'));
    assert.equal(rows[3][8], 'Unknown test plan');
    assert.ok(rows[3][9].startsWith("'=HYPERLINK"));
    assert.ok(!csv.includes('scope_oj.reason_undefined') && !csv.includes('Invalid Date'));
  }
});

test('CSV does not turn untrusted cells into Excel formulas', () => {
  const ui = view();
  for (const value of ['=1+1', '+cmd', '-cmd', '@SUM(1,1)', ' \t=1', '\r=1', '\n=1', '\ttext']) {
    ui.context.value = value;
    assert.ok(ui.run('scopeExportCsvCell(value)').startsWith('"\''));
  }
  ui.context.value = '通常, "引用"';
  assert.equal(ui.run('scopeExportCsvCell(value)'), '"通常, ""引用"""');
});

test('export always fetches ALL and leaves the selected directive, filters and current results untouched', async () => {
  const ui = view(); ui.context.fixture = fixture();
  const ids = ['scope-oj-directive', 'scope-oj-accreditation', 'scope-oj-facility', 'scope-oj-status-filter', 'scope-oj-search', 'scope-oj-basis'];
  const values = ['RED', 'jab', '2', 'withdrawn', 'no match', 'published'];
  ids.forEach((id, i) => { ui.get(id).value = values[i]; });
  ui.context.calls = [];
  ui.run('scopeOjCheckData={directive:"RED",items:[]}; apiCall=async endpoint=>{calls.push(endpoint);return {success:true,data:fixture};};');
  const before = ui.run('scopeOjCheckData');
  await ui.get('scope-oj-export-btn').listeners.click();
  assert.equal(ui.context.calls.length, 1);
  assert.equal(ui.context.calls[0], '/scope-oj-version-check?directive=ALL');
  assert.equal(ui.run('scopeOjCheckData'), before);
  assert.deepEqual(ids.map(id => ui.get(id).value), values);
  assert.equal(csvRows(ui.downloads[0][0]).length, 4);
  assert.match(ui.downloads[0][1], /^lab-scope-comparison_all_.*\.csv$/);
  assert.equal(ui.downloads[0][2], 'text/csv;charset=utf-8');
  assert.equal(ui.successes.length, 1);
  assert.equal(ui.errors.length, 0);
  assert.equal(ui.get('scope-oj-export-btn').disabled, false);
});

test('failed or incomplete retrieval produces no download and allows retry', async () => {
  for (const response of [null, { success: false }, { success: true, data: { ...fixture(), directive: 'RED' } }, { success: true, data: { ...fixture(), items: [] } }]) {
    const ui = view(); ui.context.response = response;
    ui.run('apiCall=async()=>{if(!response)throw new Error("network error");return response;};');
    await ui.run('exportAllScopeComparison()');
    assert.equal(ui.downloads.length, 0);
    assert.equal(ui.successes.length, 0);
    assert.equal(ui.errors.length, 1);
    assert.equal(ui.get('scope-oj-export-btn').disabled, false);
    assert.equal(ui.get('scope-oj-export-btn').attributes['aria-busy'], 'false');
  }
});

test('double clicks cannot start competing exports; an empty valid dataset exports just headers', async () => {
  const ui = view();
  ui.context.calls = [];
  ui.run('apiCall=endpoint=>{calls.push(endpoint);return new Promise(resolve=>{pendingExport=resolve;});};');
  const pending = ui.run('exportAllScopeComparison()');
  assert.equal(ui.get('scope-oj-export-btn').disabled, true);
  await ui.run('exportAllScopeComparison()');
  assert.equal(ui.context.calls.length, 1);
  ui.run('pendingExport({success:true,data:{directive:"ALL",items:[],summary:{total:0}}});');
  await pending;
  assert.equal(csvRows(ui.downloads[0][0]).length, 1);
});

test('all 1139 current scopes export without dropped or truncated rows', () => {
  const ui = view();
  const documents = ['a2la', 'jab'].map(certType => ({ certType, doc: parseScopesDocument(readFileSync(new URL(`../static/data/${certType}-scopes.md`, import.meta.url), 'utf8'), certType) }));
  const oj = Object.fromEntries(['RED', 'EMC', 'LVD'].map(d => [d, parseStandardsFromXlsx(readFileSync(new URL(`../static/data/${d}.xlsx`, import.meta.url)), d)]));
  const data = buildScopeOjVersionCheck(documents, oj, '2026-09-13');
  ui.context.fixture = data;
  const rows = csvRows(ui.run('scopeComparisonCsv(fixture)'));
  assert.equal(rows.length, 1140);
  assert.ok(rows.every(row => row.length === 33));
  assert.deepEqual(rows.slice(1).map(row => row[8]), data.items.map(item => item.standard));
});
