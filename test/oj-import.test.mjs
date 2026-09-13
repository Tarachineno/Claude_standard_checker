import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { parseStandardsFromRows, parseStandardsWorkbook, readRows } from '../src/lib/excel.js';
import { parseStandardReferences as parse } from '../src/lib/references.js';
import { splitOjReferenceText } from '../src/lib/oj-reference.js';
import { checkScopeAgainstOj, buildScopeOjVersionCheck } from '../src/lib/scope-oj.js';

const today = '2026-09-13';
const currentHeader = ['Legislation', 'ESO', 'Reference and title Provision', 'Start of legal effect', 'Publication OJ reference', 'Publication Decision reference', 'Publication OJ date', 'End of legal effect', 'Withdrawal OJ reference', 'Withdrawal Decision reference', 'Withdrawal OJ date'];
const title = 'Short Range Devices (SRD); Harmonised Standard covering the essential requirements of Article 3(2) of the Directive 2014/53/EU';
const number = 'EN 302 065-2 V2.1.1';
const currentRows = (reference = number + '\r\n' + title, start = '10.03.2017', end = '') => [
  ['Generated 7 September 2026'], [], currentHeader,
  ['2014/53/EU - Radio Equipment (RED)', 'ETSI', reference, start, 'OJ C 76', '', '10.03.2017', end, '', '', ''],
];

test('new EC header separates designation, title, legal-effect dates and OJ references', () => {
  for (const directive of ['RED', 'EMC', 'LVD']) {
    const [entry] = parseStandardsFromRows(currentRows(), directive);
    assert.equal(entry.number, number);
    assert.equal(entry.full_number, number);
    assert.equal(entry.title, title);
    assert.equal(entry.version, 'V2.1.1');
    assert.equal(entry.date_of_start_presumption, '2017-03-10');
    assert.equal(entry.oj_reference, 'OJ C 76');
    assert.equal(entry.restriction, '');
    assert.equal(checkScopeAgainstOj(number, [entry], today).status, 'valid');
  }
});

test('OJ edition is explicit while an undated accreditation scope remains distinct', () => {
  for (const separator of ['\r\n', ' / ']) {
    const [entry] = parseStandardsFromRows(currentRows(number + separator + title), 'RED');
    for (const [scope, status, reason] of [
      [number, 'valid', 'version_match'],
      ['EN 302 065-2 V1.1.1', 'warning', 'scope_version_old'],
      ['EN 302 065-2', 'confirmation', 'scope_version_missing'],
    ]) {
      const result = checkScopeAgainstOj(scope, [entry], today);
      assert.equal(result.status, status);
      assert.equal(result.reason, reason);
      assert.deepEqual(result.oj_versions, ['V2.1.1']);
      assert.deepEqual(result.oj_designations, [number]);
    }
    assert.equal(checkScopeAgainstOj(number, [{ number: number + separator + title }], today).status, 'valid');
  }
});

test('titles do not inject amendments; AC and dated corrections retain their actual identity', () => {
  for (const suffix of [' / ' + title, ' apparatus Annex A.1', '\nArticle 3: an EN standard']) {
    assert.deepEqual(parse(number + suffix)[0].editions, [{ base: 'V2.1.1', amendments: [], corrections: [] }]);
  }
  assert.deepEqual(parse('EN 55032:2015/A1:2020/AC:2021-11')[0].editions, [{ base: '2015', amendments: ['A1:2020'], corrections: ['COR:2021-11'] }]);
  assert.deepEqual(parse('ANSI C63.10:2020, Cor.1-2023')[0].editions[0].corrections, ['COR1:2023']);
  assert.deepEqual(parse('EN 301 489-1 (V2.2.3)')[0].versions, ['V2.2.3']);
});

test('amendment lines are retained, but standards cited in notices are not OJ listings', () => {
  const raw = 'EN 50566:2017\r\nBody mounted devices\r\nEN 50566:2017/A1:2023\r\nNotice: Do not apply tolerances in ETSI EN 301 489-1 (V2.2.3).\r\nEN 99999:2025 is mentioned in this notice only.';
  const [entry] = parseStandardsFromRows(currentRows(raw), 'RED');
  assert.equal(entry.number, 'EN 50566:2017\nEN 50566:2017/A1:2023');
  assert.ok(entry.restriction.includes('EN 301 489-1'));
  assert.ok(entry.restriction.includes('EN 99999'));
  assert.equal(checkScopeAgainstOj('EN 50566:2017', [entry], today).reason, 'amendments_missing');
  assert.equal(checkScopeAgainstOj('EN 50566:2017/A1:2023', [entry], today).status, 'valid');
  // Also cover cached/raw combined entries passed directly to the comparison.
  const result = buildScopeOjVersionCheck([{ certType: 'jab', doc: { items: [{ standard: 'EN 301 489-1' }] } }], { RED: [{ number: raw }] }, today);
  assert.equal(result.items[0].oj_status, 'not_listed');
  assert.equal(splitOjReferenceText('EN ISO/IEC 17025:2017').number, 'EN ISO/IEC 17025:2017');
});

test('new legal-effect dates exclude withdrawn and future editions, retaining coexistence', () => {
  const ended = parseStandardsFromRows(currentRows(number + '\n' + title, '10.03.2017', '13.09.2026'), 'RED')[0];
  const future = parseStandardsFromRows(currentRows('EN 302 065-2 V3.1.1\n' + title, '14.09.2026'), 'RED')[0];
  const active = parseStandardsFromRows(currentRows(), 'RED')[0];
  assert.equal(checkScopeAgainstOj(number, [ended], today).reason, 'oj_withdrawn');
  assert.equal(checkScopeAgainstOj(number, [future], today).status, 'not_listed');
  assert.equal(checkScopeAgainstOj(number, [active, future], today).oj_latest_version, 'V2.1.1');
  assert.equal(checkScopeAgainstOj(number, [active, { ...future, date_of_start_presumption: '2026-09-13' }], today).status, 'valid');
  assert.equal(checkScopeAgainstOj(number, [{ ...active, date_of_start_presumption: '', restriction_date: '2026-09-14' }], today).status, 'not_listed');
});

test('old EMC/LVD layout preserves +A1:year and never uses publication dates as editions', () => {
  const header = readRows(readFileSync(new URL('../static/data/EMC.xlsx', import.meta.url)))[0];
  const entries = parseStandardsFromRows([header,
    ['2014/30/EU', 'CEN', 'EN 617:2001+A1:2010', 'Equipment', 42480, 'OJ C 173', '-', '', '-', '', '-'],
    ['2014/30/EU', 'CEN', 'EN 55032', 'Equipment', 42480, 'OJ C 173', '-', '', '-', '', '-'],
  ], 'EMC');
  assert.equal(entries[0].number, 'EN 617:2001+A1:2010');
  assert.deepEqual(parse(entries[0].number)[0].editions[0].amendments, ['A1:2010']);
  assert.equal(entries[1].version, '');
  assert.equal(checkScopeAgainstOj('EN 55032:2000', [entries[1]], today).reason, 'oj_version_unavailable');
});

test('unknown layouts and invalid legal-effect dates fail closed', () => {
  assert.throws(() => parseStandardsFromRows([['random header'], ['EN 55032:2015']], 'RED'), /Unsupported/);
  const missing = currentRows(); missing[2] = [...currentHeader]; missing[2][7] = 'Unknown date';
  assert.throws(() => parseStandardsFromRows(missing, 'RED'), /missing end/);
  assert.throws(() => parseStandardsFromRows(currentRows(number, 'OJ C 76'), 'RED'), /Invalid EC applicability date/);
});

function workbook(rows, props = {}) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'standards');
  wb.Props = props;
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

test('source update dates use workbook generated date, then internal modification date, never download time', () => {
  const props = { ModifiedDate: new Date('2026-09-08T12:00:00Z') };
  assert.equal(parseStandardsWorkbook(workbook(currentRows(), props), 'RED').sourceUpdatedAt, '2026-09-07');
  const oldRows = currentRows().slice(2);
  const modified = parseStandardsWorkbook(workbook(oldRows, props), 'RED');
  assert.equal(modified.sourceUpdatedAt, '2026-09-08T12:00:00.000Z');
  assert.equal(modified.sourceUpdatedKind, 'xlsx_modified');
  assert.equal(parseStandardsWorkbook(workbook(oldRows), 'RED').sourceUpdatedAt, null);
});

test('all bundled OJ entries have identifiable editions and no stray title amendments', () => {
  for (const d of ['RED', 'EMC', 'LVD']) {
    const { standards, sourceUpdatedAt } = parseStandardsWorkbook(readFileSync(new URL(`../static/data/${d}.xlsx`, import.meta.url)), d);
    assert.ok(sourceUpdatedAt);
    for (const entry of standards) {
      const refs = parse(entry.number);
      assert.ok(refs.length, entry.number);
      for (const ref of refs) {
        assert.equal(ref.edition_unparsed, false, entry.number);
        assert.ok(ref.versions.length, entry.number);
        assert.ok(ref.editions.every(e => !e.amendments.includes('A')), entry.number);
      }
    }
  }
});
