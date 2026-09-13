import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { buildScopeOjVersionCheck } from '../src/lib/scope-oj.js';
import { parseStandardReferences } from '../src/lib/references.js';

const html = readFileSync(new URL('../static/index.html', import.meta.url), 'utf8');
const scripts = ['script.js', 'catalog.js'].map(file => readFileSync(new URL('../static/' + file, import.meta.url), 'utf8'));
function view() {
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, {
    value: '', innerHTML: '', textContent: '', attributes: {}, listeners: {},
    classList: { add() {}, remove() {} },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, handler) { this.listeners[name] = handler; },
  }]));
  const get = id => elements.get(id) || null;
  const context = createContext({
    Date, URL, console, navigator: {}, window: { addEventListener() {} }, localStorage: { setItem() {} },
    document: { getElementById: get, addEventListener() {}, querySelectorAll: () => [],
      querySelector: () => ({ classList: { add() {} }, focus() {} }), documentElement: {} },
  });
  const run = code => runInContext(code, context);
  for (const script of scripts) run(script);
  run('loadingOverlay = document.getElementById("loading-overlay"); errorModal = document.getElementById("error-modal"); successModal = document.getElementById("success-modal"); scopeDetailModal = document.getElementById("scope-detail-modal"); setupEventListeners();');
  get('scope-oj-basis').value = 'published';
  get('scope-oj-status-filter').value = 'all';
  return { get, run, context };
}

function comparison() {
  const ref = parseStandardReferences('IEC 61326-1:2020')[0];
  const documents = ['a2la', 'jab'].map(certType => ({ certType, doc: {
    info: { certificate_number: certType === 'jab' ? 'R009' : '7080.01' },
    facilities: [{ facility_number: '1', name: 'Shared name' }, { facility_number: '2', name: 'Second lab' }],
    items: [
      { standard: 'IEC 61326-1:2020', facility_number: '1', category: 'EMC', anchor: '#scope-1' },
      { standard: 'IEC 61326-1:2013', facility_number: certType === 'jab' ? '2' : null, description: 'old instrument test', category: 'EMC', anchor: '#scope-2' },
    ],
  } }));
  const data = buildScopeOjVersionCheck(documents, { EMC: [] }, '2026-09-12', { catalog: [{
    key: ref.key, checked_at: '2021-01-01T00:00:00Z', origin: 'manual',
    editions: [{ designation: 'IEC 61326-1:2020', edition: ref.editions[0], status: 'published' }],
  }] });
  data.sources = { oj: {}, catalog: { available: true } };
  return data;
}

test('removed certificate selector/list/search and update help do not leave broken event bindings', () => {
  const ui = view();
  for (const id of ['certificate-type-select', 'load-certificate-btn', 'certificate-results', 'scope-search-input']) assert.equal(ui.get(id), null);
  assert.ok(!html.includes('certificate.update_help_title'));
  assert.ok(!html.includes('href="/data/SCOPE_FORMAT.md"'));
  assert.ok(ui.get('scope-oj-accreditation').listeners.change);
  assert.ok(ui.get('scope-oj-facility').listeners.change);
});

test('summary buttons apply the same filter as the dropdown and retain other filters', () => {
  for (const lang of ['ja', 'en']) {
    const ui = view();
    ui.context.fixture = comparison();
    ui.run(`currentLanguage = '${lang}'; scopeOjCheckData = fixture; renderEditionComparison(fixture);`);
    const summary = ui.get('scope-oj-summary');
    assert.equal((summary.innerHTML.match(/<button type="button"/g) || []).length, 7);
    const allCards = summary.innerHTML;
    assert.deepEqual([...allCards.matchAll(/data-scope-status="([^"]+)"/g)].map(m => m[1]), ['valid','warning','caution','confirmation','not_listed','unverified','withdrawn']);
    assert.ok(allCards.includes(lang === 'ja' ? '版情報なし' : 'No scope edition'));
    const accreditationKey = ui.run('scopeAccreditationKey(fixture.items[2])');
    ui.get('scope-oj-accreditation').value = accreditationKey;
    ui.get('scope-oj-search').value = 'IEC';
    for (const status of ['valid', 'warning', 'caution', 'confirmation', 'not_listed', 'unverified', 'withdrawn']) {
      summary.listeners.click({ target: { closest: () => ({ dataset: { scopeStatus: status } }) } });
      assert.equal(ui.get('scope-oj-status-filter').value, status);
      assert.match(summary.innerHTML, new RegExp(`data-scope-status="${status}" aria-pressed="true"`));
      assert.equal((summary.innerHTML.match(/aria-pressed="true"/g) || []).length, 1);
      const byCard = ui.get('scope-oj-tbody').innerHTML;
      ui.get('scope-oj-status-filter').listeners.change();
      assert.equal(ui.get('scope-oj-tbody').innerHTML, byCard);
      assert.equal(ui.get('scope-oj-accreditation').value, accreditationKey);
      assert.equal(ui.get('scope-oj-search').value, 'IEC');
    }
    ui.get('scope-oj-status-filter').value = 'all';
    ui.get('scope-oj-status-filter').listeners.change();
    assert.ok(!summary.innerHTML.includes('aria-pressed="true"'));
    assert.ok(allCards.includes('scope-oj-summary-caution'));
  }
});

test('undated scopes use the renamed category beside caution in both languages', () => {
  assert.match(html, /value="caution"[^]*?<\/option>\s*<option value="confirmation"/);
  for (const lang of ['ja','en']) {
    const ui = view();
    const record = { key: 'IEC:61326-1', checked_at: '2026-09-13T00:00:00Z', editions: [{designation:'IEC 61326-1:2020', edition:parseStandardReferences('IEC 61326-1:2020')[0].editions[0],status:'published'}] };
    ui.context.fixture = buildScopeOjVersionCheck([{certType:'jab',doc:{items:[{standard:'IEC 61326-1'}]}}],{},'2026-09-13',{catalog:[record]});
    ui.context.fixture.sources = {oj:{},catalog:{available:true}};
    ui.run(`currentLanguage='${lang}'; scopeOjCheckData=fixture; renderEditionComparison(fixture);`);
    ui.get('scope-oj-summary').listeners.click({target:{closest:()=>({dataset:{scopeStatus:'confirmation'}})}});
    assert.match(ui.get('scope-oj-tbody').innerHTML, /scope-oj-status-confirmation/);
    assert.ok(ui.get('scope-oj-tbody').innerHTML.includes(lang === 'ja' ? '版情報なし' : 'No scope edition'));
    assert.match(ui.get('scope-oj-summary').innerHTML, /scope-oj-summary-confirmation[^]*?<strong>1<\/strong>/);
  }
});

test('withdrawal details support partial replacement and safe successor search; OJ selection clears the withdrawal filter', () => {
  const ui = view();
  const ref = parseStandardReferences('EN 55022:2010')[0];
  const record = {key:ref.key,checked_at:'2026-09-13T00:00:00Z',review_schema_version:2,
    editions:[{designation:'EN 55022:2010',edition:ref.editions[0],status:'withdrawn'}],
    lifecycle:{status:'withdrawn',withdrawal_confirmed:true,withdrawal_date:null,replacement_status:'known',source_url:'https://standards.cencenelec.eu/',replacements:[
      {key:'EN:55032',reference:'EN 55032',relation:'partial',cited_edition:'2012',note:'<script>partial coverage</script>',source_url:'https://standards.cencenelec.eu/'}]}};
  ui.context.fixture=buildScopeOjVersionCheck([{certType:'jab',doc:{items:[{standard:'EN 55022:2010'}]}}],{EMC:[{number:'EN 55022:2010'}]},'2026-09-13',{directive:'EMC',catalog:[record]});
  ui.context.fixture.sources = {oj:{},catalog:{available:true}};
  ui.get('scope-oj-search').value='EN 55032';
  ui.run('scopeOjCheckData=fixture; renderEditionComparison(fixture);');
  ui.get('scope-oj-summary').listeners.click({target:{closest:()=>({dataset:{scopeStatus:'withdrawn'}})}});
  const body=ui.get('scope-oj-tbody').innerHTML;
  for(const text of ['廃止','EN 55032','2012','&lt;script&gt;']) assert.ok(body.includes(text),text);
  assert.ok(!body.includes('<script>'));
  ui.get('scope-oj-basis').value='oj';
  ui.run('renderEditionComparison(fixture);');
  assert.equal(ui.get('scope-oj-status-filter').value,'all');
  assert.equal(ui.get('scope-oj-filter-withdrawn').disabled,true);
  assert.equal(ui.get('scope-oj-filter-withdrawn').hidden,true);
  assert.ok(!ui.get('scope-oj-summary').innerHTML.includes('data-scope-status="withdrawn"'));
});

test('scope detail shows escaped certificate notes, category restrictions and revision', () => {
  const ui = view();
  ui.context.detail = {
    category: 'Magnetic field', anchor: '#field', items: [{ standard: 'IEC 61000-4-8' }],
    facility: { number: '2', name: 'TDK' }, source: 'd1',
    certificate_info: { scope_revision: '2026-02-17', scope_notes: '<script>alert(1)</script>',
      edition_policy: '6 months', facility_notes: 'Location of facility used', fcc_note: 'FCC acceptance separate',
      category_notes: { '#field': 'Except short duration test', '#other': 'wrong category' } },
  };
  for (const lang of ['ja', 'en']) {
    ui.run(`currentLanguage = '${lang}'; renderScopeDetailModal('jab', detail);`);
    const body = ui.get('scope-detail-body').innerHTML;
    for (const text of ['2026-02-17', '6 months', 'Location of facility used', 'Except short duration test', '&lt;script&gt;']) assert.ok(body.includes(text));
    assert.ok(!body.includes('<script>') && !body.includes('wrong category'));
  }
});

test('comparison shows five columns in both languages, including empty results', () => {
  const header = html.match(/<table class="scope-oj-table">\s*<thead>([\s\S]*?)<\/thead>/)[1];
  assert.equal((header.match(/<th\b/g) || []).length, 5);
  assert.ok(!header.includes('catalog.basis_result'));
  for (const lang of ['ja', 'en']) {
    const ui = view();
    ui.context.fixture = comparison();
    ui.run(`currentLanguage = "${lang}"; renderEditionComparison(fixture);`);
    const rows = [...ui.get('scope-oj-tbody').innerHTML.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
    assert.equal(rows.length, 4);
    for (const [, row] of rows) {
      assert.equal((row.match(/<td\b/g) || []).length, 5);
      assert.match(row, /data-scope-detail-anchor/);
      assert.match(row, /scope-oj-status-/);
    }
    ui.context.fixture.items = [];
    ui.run('renderEditionComparison(fixture);');
    assert.match(ui.get('scope-oj-tbody').innerHTML, /colspan="5"/);
  }
});

test('compound-scope aggregation still drives basis-specific filtering without a summary column', () => {
  const ui = view();
  const catalog = ['IEC 61326-1:2020', 'EN 55032:2015'].map(designation => {
    const ref = parseStandardReferences(designation)[0];
    return { key: ref.key, checked_at: '2026-09-12T00:00:00Z', origin: 'manual',
      editions: [{ designation, edition: ref.editions[0], status: 'published' }] };
  });
  const fixture = buildScopeOjVersionCheck([{ certType: 'jab', doc: { items: [
    { standard: 'IEC 61326-1:2020 / EN 55032:2010', anchor: '#compound' },
  ] } }], { EMC: [{ number: 'EN 55032:2010' }] }, '2026-09-12', { directive: 'EMC', catalog });
  fixture.sources = { oj: {}, catalog: { available: true } };
  assert.equal(fixture.items[0].references.length, 2);
  assert.equal(fixture.items[0].published.status, 'warning');
  assert.equal(fixture.items[0].status, 'valid');
  ui.context.fixture = fixture;
  ui.get('scope-oj-status-filter').value = 'warning';
  ui.run('renderEditionComparison(fixture);');
  assert.equal((ui.get('scope-oj-tbody').innerHTML.match(/<td\b/g) || []).length, 5);
  assert.match(ui.get('scope-oj-summary').innerHTML, /scope-oj-summary-warning[^]*?<strong>1<\/strong>/);
  ui.get('scope-oj-basis').value = 'oj';
  ui.run('renderEditionComparison(fixture);');
  assert.match(ui.get('scope-oj-tbody').innerHTML, /colspan="5"/);
  assert.match(ui.get('scope-oj-summary').innerHTML, /scope-oj-summary-valid[^]*?<strong>1<\/strong>/);
  ui.get('scope-oj-status-filter').value = 'valid';
  ui.run('renderEditionComparison(fixture);');
  assert.equal((ui.get('scope-oj-tbody').innerHTML.match(/<td\b/g) || []).length, 5);
});

test('accreditation/facility filters are independent of status and summaries reflect the filtered population', () => {
  const ui = view();
  ui.context.fixture = comparison();
  ui.run('scopeOjCheckData = fixture; renderEditionComparison(fixture);');
  const key = ui.run('scopeAccreditationKey(fixture.items[2])');
  ui.get('scope-oj-accreditation').value = key;
  ui.get('scope-oj-accreditation').listeners.change();
  assert.equal((ui.get('scope-oj-tbody').innerHTML.match(/<tr>/g) || []).length, 2);
  assert.ok(!ui.get('scope-oj-tbody').innerHTML.includes('7080.01'));
  assert.equal((ui.get('scope-oj-facility').innerHTML.match(/<option/g) || []).length, 3);
  ui.get('scope-oj-facility').value = ui.run('scopeFacilityKey(fixture.items[2])');
  ui.get('scope-oj-facility').listeners.change();
  assert.match(ui.get('scope-oj-summary').innerHTML, /scope-oj-summary-valid[^]*?<strong>1<\/strong>/);
  assert.match(ui.get('scope-oj-summary').innerHTML, /scope-oj-summary-warning[^]*?<strong>0<\/strong>/);
  ui.get('scope-oj-status-filter').value = 'warning';
  ui.get('scope-oj-status-filter').listeners.change();
  assert.match(ui.get('scope-oj-tbody').innerHTML, /条件に一致するスコープはありません/);
  assert.match(ui.get('scope-oj-summary').innerHTML, /scope-oj-summary-valid[^]*?<strong>1<\/strong>/);
  // Same facility number/name on a different accreditation must not carry over.
  ui.get('scope-oj-accreditation').value = ui.run('scopeAccreditationKey(fixture.items[0])');
  ui.get('scope-oj-accreditation').listeners.change();
  assert.equal(ui.get('scope-oj-facility').value, 'all');
  assert.match(ui.get('scope-oj-tbody').innerHTML, /施設記載なし/);
  assert.match(ui.get('scope-oj-tbody').innerHTML, /7080\.01/);
});

test('search, language changes and reruns preserve valid filters and reset removed facilities', () => {
  const ui = view();
  ui.context.fixture = comparison();
  ui.run('scopeOjCheckData = fixture; renderEditionComparison(fixture);');
  const key = ui.run('scopeFacilityKey(fixture.items[3])');
  ui.get('scope-oj-facility').value = key;
  ui.get('scope-oj-search').value = 'old instrument';
  ui.get('scope-oj-search').listeners.input();
  assert.equal((ui.get('scope-oj-tbody').innerHTML.match(/<tr>/g) || []).length, 1);
  ui.run('switchLanguage("en");');
  assert.equal(ui.get('scope-oj-facility').value, key);
  assert.match(ui.get('scope-oj-tbody').innerHTML, /Facility 2/);
  ui.context.fixture.items.pop();
  ui.run('renderEditionComparison(fixture);');
  assert.equal(ui.get('scope-oj-facility').value, 'all');
  ui.get('scope-oj-search').value = 'does-not-exist';
  ui.get('scope-oj-search').listeners.input();
  assert.match(ui.get('scope-oj-tbody').innerHTML, /No scopes match these filters/);
  assert.match(ui.get('scope-oj-result-count').textContent, /0/);
  ui.context.fixture.items = [];
  ui.run('renderEditionComparison(fixture);');
  assert.equal(ui.get('scope-oj-accreditation').value, 'all');
  assert.equal(ui.get('scope-oj-facility').value, 'all');
});

test('bulk detail buttons escape data and open the matching accreditation/anchor', () => {
  const ui = view();
  ui.context.fixture = comparison();
  const anchor = '#lab-"<&\'>';
  ui.context.fixture.items[2].anchor = anchor;
  ui.run('renderEditionComparison(fixture);');
  assert.match(ui.get('scope-oj-tbody').innerHTML, /data-scope-detail-anchor="#lab-&quot;&lt;&amp;&#39;&gt;"/);
  assert.ok(!ui.get('scope-oj-tbody').innerHTML.includes('onclick='));
  let opened;
  ui.context.openScopeDetails = (...args) => { opened = args; };
  ui.get('scope-oj-tbody').listeners.click({ target: { closest: () => ({ dataset: { scopeDetailCert: 'jab', scopeDetailAnchor: anchor } }) } });
  assert.deepEqual(opened, ['jab', anchor]);
});

test('cards load independently of a bulk check, translate and allow retry after failure', async () => {
  const ui = view();
  let attempts = 0;
  ui.context.apiCall = async path => {
    assert.equal(path, '/accreditations');
    if (++attempts === 2) throw new Error('offline');
    return { success: true, data: { items: [{ cert_type: 'jab', certificate_number: 'R009',
      available: true, organization: '<Lab>', valid_until: '2027-01-01', item_count: 12, source: 'd1', pdf_url: '/certificates/jab.pdf' }] } };
  };
  ui.run('switchTab("certificate");');
  await ui.run('loadAccreditationCards();'); // joins the microtask turn without issuing another request
  assert.equal(attempts, 1);
  assert.match(ui.get('accreditation-cards').innerHTML, /R009/);
  assert.match(ui.get('accreditation-cards').innerHTML, /&lt;Lab&gt;/);
  assert.match(ui.get('accreditation-cards').innerHTML, /認定書番号/);
  assert.match(ui.get('accreditation-cards').innerHTML, /href="\/certificates\/jab\.pdf"/);
  assert.equal(ui.run('scopeOjCheckData'), null);
  ui.run('switchLanguage("en");');
  assert.match(ui.get('accreditation-cards').innerHTML, /Accreditation Number/);
  await ui.run('loadAccreditationCards();');
  assert.match(ui.get('accreditation-cards').innerHTML, /could not be loaded/);
  assert.ok(!ui.get('accreditation-cards').innerHTML.includes('R009'));
  assert.match(ui.get('accreditation-cards').innerHTML, /data-accreditation-retry/);
  await ui.run('loadAccreditationCards();');
  assert.match(ui.get('accreditation-cards').innerHTML, /R009/);
  assert.equal(ui.get('accreditation-cards').attributes['aria-busy'], 'false');
});

test('a failed card does not hide healthy cards or the PDF entry and cannot inject an unsafe link', async () => {
  const ui = view();
  ui.context.apiCall = async () => ({ success: true, data: { items: [
    { cert_type: 'a2la', available: true, certificate_number: '7080.01', item_count: 83, source: 'md', pdf_url: '/certificates/a2la.pdf' },
    { cert_type: 'jab', available: false, pdf_url: '/certificates/jab.pdf' },
    { cert_type: 'unknown', available: false, pdf_url: 'javascript:alert(1)' },
  ] } });
  await ui.run('loadAccreditationCards();');
  const rendered = ui.get('accreditation-cards').innerHTML;
  assert.match(rendered, /7080\.01/);
  assert.match(rendered, /href="\/certificates\/jab\.pdf"/);
  assert.match(rendered, /data-accreditation-retry/);
  assert.ok(!rendered.includes('javascript:'));
});
