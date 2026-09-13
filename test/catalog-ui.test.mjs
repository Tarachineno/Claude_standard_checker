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
