import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkScopeAgainstOj, compareEditionVersions } from '../src/lib/scope-oj.js';

const active = (number, version = null) => ({ directive: 'EMC', number, version, active: true });

test('OJ without an edition makes any accreditation edition valid', () => {
  const result = checkScopeAgainstOj('EN 12345:2010', [active('EN 12345')], '2026-09-12');
  assert.equal(result.status, 'valid');
  assert.equal(result.reason, 'oj_version_unavailable');
});

test('older accreditation edition is warned and missing edition is cautioned', () => {
  const oj = [active('EN 12345:2015')];
  const old = checkScopeAgainstOj('EN 12345:2010', oj, '2026-09-12');
  assert.equal(old.status, 'warning');
  assert.equal(old.reason, 'scope_version_old');

  const missing = checkScopeAgainstOj('EN 12345', oj, '2026-09-12');
  assert.equal(missing.status, 'caution');
  assert.equal(missing.reason, 'scope_version_missing');
});

test('matching active edition is valid and withdrawn-only entry is not listed', () => {
  const match = checkScopeAgainstOj('EN 12345 V1.2.3', [active('EN 12345 V1.2.3')], '2026-09-12');
  assert.equal(match.status, 'valid');
  assert.equal(match.reason, 'version_match');

  const withdrawn = checkScopeAgainstOj('EN 12345:2015', [{ directive: 'EMC', number: 'EN 12345:2015', active: false }], '2026-09-12');
  assert.equal(withdrawn.status, 'not_listed');
  assert.equal(withdrawn.reason, 'oj_withdrawn');
});

test('an earlier edition remains valid during OJ coexistence', () => {
  const result = checkScopeAgainstOj('EN 12345:2015', [active('EN 12345:2015'), active('EN 12345:2020')], '2026-09-12');
  assert.equal(result.oj_latest_version, '2020');
  assert.equal(result.status, 'valid');
  assert.equal(result.reason, 'version_match');
});

test('edition comparison supports years and semantic V versions', () => {
  assert.equal(compareEditionVersions('2010', '2015'), -1);
  assert.equal(compareEditionVersions('V1.2.3', 'V1.10.0'), -1);
  assert.equal(compareEditionVersions('2010', 'V1.0.0'), null);
});
