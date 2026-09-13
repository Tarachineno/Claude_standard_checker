import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStandardReferences as parse, parseEditions, coversEdition } from '../src/lib/references.js';
import { checkScopeAgainstOj, checkPublished, buildScopeOjVersionCheck } from '../src/lib/scope-oj.js';

const today = '2026-09-12';
const pub = (text, extra = {}) => ({ checked_at: today + 'T00:00:00Z', origin: 'automatic', editions: parse(text)[0].editions.map(edition => ({ designation: text, edition, status: 'published' })), ...extra });
const oj = number => [{ number }];

test('explicit edition alternatives include 2013 and do not form a part number', () => {
  const [ref] = parse('EN 61326-1:2012/2013');
  assert.equal(ref.key, 'EN:61326-1');
  assert.deepEqual(ref.versions, ['2012', '2013']);
  assert.equal(checkScopeAgainstOj(ref, oj('EN 61326-1:2013'), today).status, 'valid');
  assert.equal(checkScopeAgainstOj(ref, oj('EN 61326-1:2021'), today).status, 'warning');
});
test('part lists and compound references remain independent', () => {
  assert.deepEqual(parse('EN 301 489-1 / -3 / -52').map(r => r.key), ['EN:301489-1', 'EN:301489-3', 'EN:301489-52']);
  assert.deepEqual(parse('IEC 62236-3-2 / EN 50121-3-2').map(r => r.key), ['IEC:62236-3-2', 'EN:50121-3-2']);
});
test('national adoptions are not equated and ETSI spelling is normalized', () => {
  const texts = ['EN 61000-4-2', 'EN IEC 61000-4-2', 'IEC 61000-4-2', 'KS C IEC 61000-4-2', 'JIS C 61000-4-2'];
  assert.equal(new Set(texts.map(t => parse(t)[0].key)).size, 5);
  assert.equal(parse('ETSI EN 300 328 V2.2.2')[0].key, 'EN:300328');
  assert.equal(parse('VCCI rule V-3')[0].key, 'VCCI:V-3');
  assert.equal(parse('UNII-MP')[0].key, 'UNII:MP');
  assert.equal(parse('RSS-102.SAR.MEAS')[0].key, 'RSS:102.SAR.MEAS');
  assert.notEqual(parse('RSS-102.SAR.MEAS')[0].key, parse('RSS-102')[0].key);
});
test('ANSI editions and corrections are parsed from nested FCC references', () => {
  const [ref] = parse('FCC Part15C (ANSI C63.10:2013 / 2020, Cor.1-2023)');
  assert.equal(ref.key, 'ANSI:C63.10');
  assert.deepEqual(ref.editions.at(-1), { base: '2020', amendments: [], corrections: ['COR1:2023'] });
  assert.equal(parse('ANSI C63.10-2020')[0].versions[0], '2020');
});
test('a required amendment is not satisfied by the base alone', () => {
  const [base] = parse('EN 55032:2015'), [amend] = parse('EN 55032:2015+A1:2020');
  assert.equal(coversEdition(base.editions[0], amend.editions[0]), false);
  assert.equal(checkScopeAgainstOj(base, oj('EN 55032:2015+A1:2020'), today).reason, 'amendments_missing');
  assert.equal(checkScopeAgainstOj(amend, oj('EN 55032:2015+A1:2020'), today).status, 'valid');
  assert.equal(checkScopeAgainstOj(base, oj('EN 55032:2015\nEN 55032:2015/A1:2020'), today).status, 'caution');
  assert.equal(checkScopeAgainstOj(base, [...oj('EN 55032:2015'), ...oj('EN 55032:2015/A1:2020')], today).status, 'caution');
});
test('OJ publication metadata is not a normative edition; malformed edition is not undated', () => {
  assert.equal(checkScopeAgainstOj('EN 55032:2000', [{ number: 'EN 55032', version: '2026' }], today).reason, 'oj_version_unavailable');
  assert.equal(checkScopeAgainstOj('EN 55032:2000', oj('EN 55032:unknown'), today).status, 'unverified');
});
test('future applicability and withdrawal boundaries override active flags', () => {
  assert.equal(checkScopeAgainstOj('EN 55032:2015', [{ number: 'EN 55032:2015', active: true, date_of_start_presumption: '2026-09-13' }], today).status, 'not_listed');
  assert.equal(checkScopeAgainstOj('EN 55032:2015', [{ number: 'EN 55032:2015', active: true, withdrawal_date: today }], today).status, 'not_listed');
});
test('Published chooses latest, separates missing-edition confirmation and rejects draft/future dates', () => {
  const record = pub('IEC 61326-1:2013/2020');
  assert.equal(checkPublished(parse('IEC 61326-1:2013')[0], record, today).status, 'warning');
  assert.equal(checkPublished(parse('IEC 61326-1:2012/2020')[0], record, today).status, 'valid');
  assert.equal(checkPublished(parse('IEC 61326-1')[0], record, today).status, 'confirmation');
  record.editions[1].status = 'draft';
  assert.equal(checkPublished(parse('IEC 61326-1:2013')[0], record, today).status, 'valid');
  record.editions[1].status = 'published'; record.editions[1].publication_date = '2026-09-13';
  assert.equal(checkPublished(parse('IEC 61326-1:2013')[0], record, today).status, 'valid');
});
test('Published verification does not expire after eight days, months or years', () => {
  for (const origin of ['automatic', 'manual']) {
    for (const checked_at of ['2026-09-04T00:00:00Z', '2026-09-01T00:00:00Z', '2026-01-01T00:00:00Z', '2021-01-01T00:00:00Z']) {
      const record = pub('IEC 61326-1:2020', { origin, checked_at });
      for (const [scope, status, reason] of [
        ['IEC 61326-1:2020', 'valid', 'version_match'],
        ['IEC 61326-1:2013', 'warning', 'scope_version_old'],
        ['IEC 61326-1', 'confirmation', 'scope_version_missing'],
      ]) {
        const result = checkPublished(parse(scope)[0], record, today);
        assert.equal(result.status, status);
        assert.equal(result.reason, reason);
        assert.equal(result.record.checked_at, checked_at);
      }
    }
  }
});
test('failed checks retain previous values and verification dates but are never valid', () => {
  const ref = parse('IEC 61326-1:2020')[0];
  for (const checked_at of [today + 'T00:00:00Z', '2021-01-01T00:00:00Z']) {
    const result = checkPublished(ref, pub('IEC 61326-1:2020', { checked_at, error: 'HTTP 503' }), today);
    assert.equal(result.status, 'unverified');
    assert.equal(result.reason, 'fetch_failed');
    assert.equal(result.latest.edition.base, '2020');
    assert.equal(result.record.checked_at, checked_at);
  }
  assert.equal(checkPublished(ref, null, today).status, 'unverified');
});
test('missing or invalid verification dates remain unverified without implying expiry', () => {
  for (const checked_at of [undefined, null, '', 'bad date']) {
    const result = checkPublished(parse('IEC 61326-1:2020')[0], pub('IEC 61326-1:2020', { checked_at }), today);
    assert.equal(result.status, 'unverified');
    assert.equal(result.reason, 'verification_date_invalid');
    assert.equal(result.latest.edition.base, '2020');
  }
});
test('Issue editions are comparable; years versus versions are not', () => {
  assert.equal(checkPublished(parse('RSS-210 Issue 10')[0], pub('RSS-210 Issue 11'), today).status, 'warning');
  assert.equal(checkPublished(parse('RSS-210:2020')[0], pub('RSS-210 Issue 11'), today).status, 'unverified');
  assert.equal(parseEditions(':unknown').edition_unparsed, true);
});
test('directive-specific OJ results are independent; unknown scopes are retained', () => {
  const docs = [{ certType: 'jab', source: 'd1', doc: { items: [{ standard: 'EN 61326-1:2013' }, { standard: 'Unknown test plan' }] } }];
  const standards = { EMC: oj('EN 61326-1:2013'), RED: oj('EN 61326-1:2021') };
  const emc = buildScopeOjVersionCheck(docs, standards, today, { directive: 'EMC' });
  const red = buildScopeOjVersionCheck(docs, standards, today, { directive: 'RED' });
  assert.equal(emc.items[0].status, 'valid');
  assert.deepEqual(emc.items[0].oj_versions, ['2013']);
  assert.equal(emc.items[0].oj_latest_version, '2013');
  assert.equal(red.items[0].status, 'warning');
  assert.equal(emc.items.length, 2);
  assert.equal(emc.items[1].status, 'unverified');
  const failed = buildScopeOjVersionCheck(docs, standards, today, { directive: 'EMC', ojErrors: { EMC: 'failed' } });
  assert.equal(failed.items[0].status, 'unverified');
});
