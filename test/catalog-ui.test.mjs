import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { parseStandardReferences } from '../src/lib/references.js';
import { buildScopeOjVersionCheck } from '../src/lib/scope-oj.js';

const script = readFileSync(new URL('../static/catalog.js', import.meta.url), 'utf8');

test('official portal search follows catalogue management and precedes additional publishers', () => {
  const html = readFileSync(new URL('../static/index.html', import.meta.url), 'utf8');
  assert.ok(!html.includes('catalog-refresh-btn'));
  assert.ok(!script.includes('data-catalog-refresh'));
  assert.ok(!script.includes("catalogWrite('refresh'"));
  const searchTab = html.match(/<section id="search-tab"[\s\S]*?<\/section>/)?.[0];
  assert.ok(searchTab, 'official search tab exists');
  const markers = [
    'class="publisher-catalog"',
    'id="catalog-admin"',
    'data-i18n="catalog.help"',
    'data-i18n="search.description"',
    'id="search-input"',
    'id="search-etsi-btn"',
    'id="search-cen-btn"',
    'data-i18n="search.additional_publishers"',
  ];
  let previous = -1;
  for (const marker of markers) {
    const position = searchTab.indexOf(marker);
    assert.ok(position > previous, `${marker} appears in the expected order`);
    assert.equal(html.split(marker).length - 1, 1, `${marker} occurs only once`);
    previous = position;
  }
});

function renderViews(lang, checked_at, origin = 'manual') {
  const reference = parseStandardReferences('IEC 61326-1:2020')[0];
  const record = { key: reference.key, origin, checked_at, editions: [{
    designation: 'IEC 61326-1:2020', edition: reference.editions[0], status: 'published',
  }] };
  const comparison = buildScopeOjVersionCheck([{ certType: 'jab', doc: {
    items: [{ standard: 'IEC 61326-1:2020' }],
  } }], {}, '2026-09-12', { catalog: [record] });
  comparison.sources = { oj: {}, catalog: { available: true } };
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', innerHTML: '', textContent: '', classList: { remove() {} } });
    return elements.get(id);
  };
  element('catalog-provider').value = 'all';
  element('scope-oj-basis').value = 'published';
  element('scope-oj-status-filter').value = 'all';
  const translations = { ja: {}, en: {} };
  const t = key => translations[lang][key] || key;
  const context = createContext({
    Date, URL, translations, t,
    document: { getElementById: element, addEventListener() {} },
    esc: value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
    scopeOjStatusLabel: status => status,
    scopeOjReasonLabel: reason => t('scope_oj.reason_' + reason),
    fixture: { comparison, catalog: { available: true, items: [{
      ...reference, record, automatic_supported: true, scope_count: 1,
    }] } },
  });
  runInContext(script, context);
  runInContext('catalogData = fixture.catalog; renderCatalog(); renderEditionComparison(fixture.comparison);', context);
  return {
    context, element,
    catalogue: element('catalog-tbody').innerHTML,
    comparison: element('scope-oj-tbody').innerHTML,
    result: comparison,
  };
}

test('catalogue and bulk views label the saved verification date in Japanese and English', () => {
  const checked_at = '2021-01-01T00:00:00Z';
  for (const [lang, label] of [['ja', '最終確認日時'], ['en', 'Last verified']]) {
    for (const origin of ['manual', 'automatic']) {
      const views = renderViews(lang, checked_at, origin);
      for (const html of [views.catalogue, views.comparison]) {
        assert.ok(html.includes(label + ': ' + new Date(checked_at).toLocaleString()));
        assert.ok(!html.includes('Invalid Date'));
      }
      assert.equal(views.result.published_summary.valid, 1);
      assert.equal(views.result.published_summary.unverified, 0);
      assert.match(views.comparison, /scope-oj-status-valid/);
    }
  }
});

test('paused editing hides row mutations but retains editions, official sources and history in both languages', () => {
  const html = readFileSync(new URL('../static/index.html', import.meta.url), 'utf8');
  assert.match(html, /<details\b[^>]*id="catalog-admin"[^>]*\shidden[\s>]/);
  for (const lang of ['ja', 'en']) {
    const ui = renderViews(lang, '2026-09-13T00:00:00Z');
    runInContext(`
      fixture.catalog.items[0].search_url = 'https://webstore.iec.ch/';
      fixture.catalog.items.push({...fixture.catalog.items[0], key:'IEC:61000-4-2', designation:'IEC 61000-4-2', record:null});
      fixture.catalog.items.push({...fixture.catalog.items[0], key:'EN:55022', designation:'EN 55022', record:{review_schema_version:2, origin:'manual', lifecycle:{status:'withdrawn',replacement_status:'unknown'}}});
      renderCatalog();
    `, ui.context);
    const output = ui.element('catalog-tbody').innerHTML;
    assert.doesNotMatch(output, /data-catalog-(?:edit|clear)=/);
    assert.match(output, /data-catalog-history="IEC:61326-1"/);
    assert.match(output, /data-catalog-history="EN:55022"/);
    assert.match(output, /https:\/\/webstore\.iec\.ch\//);
    assert.match(output, /IEC 61326-1:2020/);
    assert.match(output, /scope-oj-status-withdrawn/);
    ui.element('catalog-search').value = '61326';
    runInContext('renderCatalog()', ui.context);
    assert.doesNotMatch(ui.element('catalog-tbody').innerHTML, /data-catalog-(?:edit|clear)=/);
    assert.match(ui.element('catalog-tbody').innerHTML, /data-catalog-history=/);
  }
});

function initializedCatalogue() {
  const html = readFileSync(new URL('../static/index.html', import.meta.url), 'utf8');
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, {
    value: '', innerHTML: '', textContent: '', hidden: false, open: false, listeners: {},
    addEventListener(name, handler) { this.listeners[name] = handler; },
    classList: { remove() {} }, setAttribute() {},
  }]));
  const get = id => elements.get(id);
  const options = html.match(/<select id="scope-oj-directive">([^]*?)<\/select>/)[1];
  get('scope-oj-directive').value = options.match(/<option value="([^"]+)" selected>/)[1];
  get('scope-oj-basis').value = 'published';
  get('catalog-provider').value = 'all';
  const callbacks = [], calls = [];
  const context = createContext({Date, URL, URLSearchParams, console, navigator:{}, localStorage:{setItem(){}},
    window:{addEventListener(){},location:{search:'?catalog-login=1'}},
    document:{getElementById:get,addEventListener(name,fn){callbacks.push(fn);}}, calls,
  });
  const run = code => runInContext(code, context);
  run(readFileSync(new URL('../static/script.js', import.meta.url), 'utf8'));
  run(script);
  run('apiCall=async path=>{calls.push(path);return {success:true,data:[]};}; showError=message=>{throw new Error(message);};');
  callbacks.at(-1)();
  return {get,run,calls,context,options};
}

test('paused editing cannot open from login return or submit; read-only history remains usable', async () => {
  const ui = initializedCatalogue();
  assert.equal(ui.get('catalog-admin').hidden, true);
  assert.equal(ui.get('catalog-admin').open, false);
  assert.equal(ui.calls.length, 0, 'no unused authentication request');
  ui.run('catalogData={items:[{key:"IEC:61326-1",designation:"IEC 61326-1"}]};');
  for (const dataset of [{catalogEdit:'IEC:61326-1'}, {catalogClear:'IEC:61326-1'}]) {
    await ui.get('catalog-tbody').listeners.click({target:{closest:()=>({dataset})}});
  }
  let prevented = false;
  await ui.get('catalog-manual-form').listeners.submit({preventDefault(){prevented=true;}});
  assert.equal(prevented, true);
  await assert.rejects(ui.run('catalogWrite("manual",{})'), /一時的に停止|temporarily unavailable/);
  assert.equal(ui.calls.length, 0);
  assert.equal(ui.get('catalog-admin').open, false);
  await ui.get('catalog-tbody').listeners.click({target:{closest:()=>({dataset:{catalogHistory:'IEC:61326-1'}})}});
  assert.deepEqual(ui.calls, ['/catalog/history?key=IEC%3A61326-1']);
});

test('all OJ directives are selected initially and individual selections remain available', async () => {
  const ui = initializedCatalogue();
  assert.equal(ui.get('scope-oj-directive').value, 'ALL');
  assert.deepEqual([...ui.options.matchAll(/value="([^"]+)"/g)].map(m=>m[1]), ['ALL','EMC','RED','LVD']);
  ui.run('showLoading=()=>{}; hideLoading=()=>{}; renderScopeOjVersionResults=()=>{};');
  await ui.run('runScopeOjVersionCheck()');
  assert.deepEqual(ui.calls, ['/scope-oj-version-check?directive=ALL']);
  ui.run('scopeOjCheckData=null;');
  for (const [directive,basis] of [['RED','oj'],['LVD','oj'],['EMC','published'],['ALL','published']]) {
    ui.get('scope-oj-directive').value = directive;
    ui.get('scope-oj-directive').listeners.change();
    assert.equal(ui.get('scope-oj-basis').value, basis);
  }
});

test('catalogue and bulk views show unknown for missing or invalid verification dates', () => {
  for (const [lang, label] of [['ja', '最終確認日時: 不明'], ['en', 'Last verified: Unknown']]) {
    for (const checked_at of [undefined, null, '', 'bad date']) {
      const views = renderViews(lang, checked_at);
      for (const html of [views.catalogue, views.comparison]) {
        assert.ok(html.includes(label));
        assert.ok(!html.includes('Invalid Date'));
      }
      assert.equal(views.result.published_summary.unverified, 1);
      assert.ok(!views.comparison.includes('scope_oj.reason_verification_date_invalid'));
    }
  }
});
