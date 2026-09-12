import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseScopesDocument } from '../src/lib/md.js';
import { parseStandardReferences } from '../src/lib/references.js';
import { withSearchLinks } from '../src/lib/catalog.js';
import app from '../src/index.js';
import { env } from './helpers.mjs';

const doc = type => parseScopesDocument(readFileSync(new URL(`../static/data/${type}-scopes.md`, import.meta.url), 'utf8'), type);

test('replacement PDFs match their recorded source hashes and scope revisions', () => {
  for (const [type, revision] of [['a2la', '2025-11-07'], ['jab', '2026-02-17']]) {
    assert.equal(doc(type).info.scope_revision, revision);
    const hash = createHash('sha256').update(readFileSync(new URL(`../static/certificates/${type}.pdf`, import.meta.url))).digest('hex');
    assert.equal(doc(type).info.source_pdf_sha256, hash);
  }
});

test('A2LA superscript 1 is a field-testing note, never a railway part or edition', () => {
  const d = doc('a2la');
  assert.equal(d.items.length, 88);
  assert.ok(!d.items.some(i => /62236-3-11|50121-3-11|footnote|Field testing/.test(i.standard)));
  const railway = d.items.find(i => i.standard === 'IEC 62236-3-1 / EN 50121-3-1');
  assert.match(railway.description, /Field testing.*footnote 1/);
  assert.deepEqual(parseStandardReferences(railway.standard).map(r => r.key), ['IEC:62236-3-1', 'EN:50121-3-1']);
  const correction = d.items.find(i => i.standard === 'ANSI C63.10-2020 + Cor.1-2023');
  const ref = parseStandardReferences(correction.standard)[0];
  assert.equal(ref.editions[0].base, '2020');
  assert.deepEqual(ref.editions[0].corrections, ['COR1:2023']);
  assert.ok(d.items.filter(i => i.standard.includes('15C')).every(i => !i.standard.includes('Cor.')));
  assert.match(d.items.find(i => i.standard.includes('15B')).description, /40000 MHz/);
  assert.match(d.items.find(i => i.standard.includes('15E') && i.standard.includes('KDB')).description, /with DFS.*236000 MHz/);
  assert.match(d.info.edition_policy, /1年間/);
});

test('JAB contains exactly the three missing EFT standards; notes are not standards', () => {
  const d = doc('jab');
  assert.equal(d.items.length, 1051);
  const eft = d.items.filter(i => i.facility_number === '1' && i.category.startsWith('M21.4.16 '));
  for (const standard of ['ISO 80601-2-61', 'EN ISO 80601-2-61', 'JIS T 80601-2-61']) assert.ok(eft.some(i => i.standard === standard));
  assert.ok(!eft.some(i => i.standard === 'JIS T 80601-2-56'), 'not listed in PDF p.6; do not infer from adjacent standards');
  assert.ok(!d.items.some(i => /Except short duration test/.test(i.standard)));
  for (const n of [1, 2]) assert.match(d.info.category_notes[`#facility-${n}-magnetic-field`], /Except short duration test/);
  assert.ok(d.categories.every(category => d.items.some(i => i.category === category)));
  assert.ok(d.categories.every(category => /^M21\./.test(category)));
  const radio = d.items.filter(i => i.standard === 'EN 300 330:V2.1.1(2017-02)');
  assert.equal(radio.length, 2);
  for (const item of radio) { assert.equal(item.facility_number, '2'); assert.match(item.description, /magnetic field.*below 30 MHz/); }
  assert.match(d.info.edition_policy, /6か月/);
});

test('scope detail API retains certificate and category conditions', async () => {
  const response = await app.request('/api/scope-detail?cert_type=jab&anchor=%23facility-2-magnetic-field', {}, env);
  const { data } = await response.json();
  assert.equal(response.status, 200);
  assert.match(data.certificate_info.category_notes[data.anchor], /Except short duration test/);
  assert.match(data.certificate_info.facility_notes, /Location of facility used/);
  assert.equal(data.certificate_info.scope_revision, '2026-02-17');
});

test('SEMI and AS/NZS keep their catalogue keys but have distinct publisher filters and official links', () => {
  const refs = ['SEMI F47', 'SEMI E6', 'AS/NZS 4268'].flatMap(parseStandardReferences);
  assert.deepEqual(refs.map(r => r.key), ['SEMI:F47', 'SEMI:E6', 'AS/NZS:4268']);
  assert.deepEqual(refs.map(r => r.provider), ['semi', 'semi', 'as_nzs']);
  const record = { key: 'AS/NZS:4268', origin: 'manual', note: 'retained' };
  const items = withSearchLinks(refs, [record]);
  assert.ok(items.every(i => !i.automatic_supported && i.search_url.startsWith('https://')));
  assert.equal(items[2].record, record);
});
