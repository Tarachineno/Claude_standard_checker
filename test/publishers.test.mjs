import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStandardReferences as parse } from '../src/lib/references.js';
import { officialUrl, fetchOfficial, parseEtsi, parseIec, parseCen, parseIsed, fetchPublisher } from '../src/lib/publishers.js';

test('official URLs reject impostor domains, credentials, alternate ports and non-HTTPS', () => {
  assert.ok(officialUrl('https://webstore.iec.ch/en/publication/123'));
  for (const u of ['https://iec.ch.evil.example/a', 'http://iec.ch', 'https://user:pass@iec.ch', 'https://iec.ch:8443', 'https://127.0.0.1', 'file:///etc/passwd']) assert.equal(officialUrl(u), false);
});
test('ETSI filters noncurrent and nonpublished versions and preserves exact reference', () => {
  const row = { ETSI_DELIVERABLE: 'EN 300 328 V2.2.2 (2019-07)', ACTION_TYPE: 'PU', IsCurrent: 1, superseded: 0, EDSpathname: 'etsi_en/300300_300399/300328/02.02.02_60/', EDSPDFfilename: 'en_300328v020202p.pdf' };
  const r = parseEtsi([row, { ...row, ACTION_TYPE: 'AP' }, { ...row, IsCurrent: 0 }, { ...row, superseded: 1 }, { ...row, ETSI_DELIVERABLE: 'EN 300 330 V2.2.2' }], parse('EN 300 328')[0]);
  assert.equal(r.length, 1); assert.equal(r[0].edition.base, 'V2.2.2');
});
test('IEC lifecycle combines published amendments, excludes old revisions and drafts', () => {
  const source = { reference: 'IEC 61326-1:2020', status: 'PUBLISHED', id: 10, edition: '3.0', publication_date: '2020-10-26', lifecycle: [
    { reference: 'IEC 61326-1:2012', status: 'REVISED', id: 9 },
    { reference: 'IEC 61326-1:2020/AMD1:2025', status: 'PUBLISHED', id: 11 },
    { reference: 'IEC 61326-1:2020/COR1:2026', status: 'PUBLISHED', id: 12 },
    { reference: 'IEC 61326-1:2027 PRV', status: 'PUBLISHED', id: 13 },
  ] };
  const data = { primary: { hits: { total: { relation: 'eq', value: 1 }, hits: [{ _source: source }] } } };
  const result = parseIec(data, parse('IEC 61326-1')[0]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].edition, { base: '2020', amendments: ['A1:2025'], corrections: ['COR1:2026'] });
  data.primary.hits.total.value = 2;
  assert.throws(() => parseIec(data, parse('IEC 61326-1')[0]), /incomplete/);
});
test('CEN publication rows combine amendments and flag changed designation', () => {
  const row = (n, state) => `<tr><td><a href="https://standards.cencenelec.eu/project/123">${n}</a></td><td>${state}</td></tr>`;
  const html = row('EN IEC 61326-1:2021', 'Published') + row('EN IEC 61326-1:2021/A11:2026', 'Published') + row('EN 61326-1:2013', 'Withdrawn') + row('EN IEC 61326-1:2028', 'Draft');
  const r = parseCen(html, parse('EN 61326-1')[0], 'https://standards.cencenelec.eu');
  assert.equal(r.length, 1); assert.equal(r[0].reference_changed, true);
  assert.deepEqual(r[0].edition.amendments, ['A11:2026']);
});
test('ISED uses the issue in the document header, not replacement or footer dates', () => {
  const html = '<h1>RSS-210 — Licence-exempt apparatus</h1><p>Issue 11<br>June 2024<br>Amendment 1</p><h2>Preface</h2><p>Replaces Issue 10, 2019</p><footer>Date modified: 2026</footer>';
  const r = parseIsed(html, parse('RSS-210')[0], 'https://ised-isde.canada.ca/rss-210');
  assert.equal(r[0].edition.base, 'Issue 11');
  assert.deepEqual(r[0].edition.amendments, ['A1']);
  assert.throws(() => parseIsed(html, parse('RSS-247')[0], 'https://ised-isde.canada.ca/rss-210'), /not confirmed/);
});
test('unsupported publishers never treat an old detail page as proof of latest', async () => {
  await assert.rejects(fetchPublisher(parse('ISO 9001')[0], 'https://iso.org/standard/old.html'), /Manual verification/);
});
test('redirect validation prevents fetching an unofficial destination', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response(null, { status: 302, headers: { location: 'https://evil.example' } }); });
  await assert.rejects(fetchOfficial('https://www.etsi.org/test'), /Unapproved/);
  assert.equal(calls, 1);
});

test('ISED follows the official JSON table and selects only the exact reference', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(String(url));
    if (String(url).includes('list.json')) return new Response(JSON.stringify({ data: [
      { Type: 'RSS', Title: '<a href="https://ised-isde.canada.ca/rss-sar">RSS-102.SAR.MEAS</a>' },
      { Type: 'RSS', Title: '<a href="https://ised-isde.canada.ca/rss-main">RSS-102</a>' },
    ] }));
    if (String(url).includes('rss-main')) return new Response('<h1>RSS-102</h1><p>Issue 6</p><h2>Preface</h2>');
    return new Response('<table data-wb-tables="{&quot;ajaxSource&quot;:&quot;/list.json&quot;}"></table>');
  });
  const r = await fetchPublisher(parse('RSS-102')[0]);
  assert.equal(r.editions[0].edition.base, 'Issue 6');
  assert.ok(!calls.some(u => u.includes('rss-sar')));
});
