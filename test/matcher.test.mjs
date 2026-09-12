import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMDToScopeData } from '../src/lib/md.js';
import { findScopeMatch, searchInScopes, extractStandardCore, splitStandardsInput, verdictOf } from '../src/lib/matcher.js';

const a2la = parseMDToScopeData(readFileSync(new URL('../static/data/a2la-scopes.md', import.meta.url), 'utf8'), 'a2la').scopes;
const jab = parseMDToScopeData(readFileSync(new URL('../static/data/jab-scopes.md', import.meta.url), 'utf8'), 'jab').scopes;

test('extractStandardCore', () => {
  assert.equal(extractStandardCore('EN 55032:2015'), '55032');
  assert.equal(extractStandardCore('EN 301 489-1 V2.2.3'), '301-489-1');
  assert.equal(extractStandardCore('ETSI EN 300 328'), '300-328');
  assert.equal(extractStandardCore('KS C 9610-4-2'), '9610-4-2');
});

test('exact / version tolerant / mismatch against JAB', () => {
  assert.equal(findScopeMatch('EN 55011', jab).status, 'exact_match');
  const vt = findScopeMatch('EN 55032:2015', jab);
  assert.equal(vt.status, 'version_tolerant_match');
  assert.match(vt.facility, /施設1/);
  assert.equal(findScopeMatch('EN 55022:2016', jab).status, 'version_mismatch');
  assert.equal(findScopeMatch('EN 99999', jab).status, 'no_match');
});

test('comprehensive scope match against A2LA', () => {
  const r = findScopeMatch('EN 301 489-52 V1.2.1', a2la);
  assert.equal(r.status, 'comprehensive_match');
  assert.match(r.note, /包括スコープ適用/);
  const r2 = findScopeMatch('ETSI EN 302 065-2', a2la);
  assert.equal(r2.status, 'comprehensive_match');
});

test('scope search range notation', () => {
  const m = searchInScopes('302 065-2', a2la);
  assert.ok(m.some(x => x.match_type === 'range_match' || x.match_type === 'partial'));
  assert.ok(searchInScopes('55032', jab).length > 0);
});

test('splitStandardsInput handles messy paste', () => {
  const list = splitStandardsInput('1. EN 55032:2015\nEN 301 489-17, EN 300 328;  en 55032:2015\n\n- IEC 61000-4-2');
  assert.deepEqual(list, ['EN 55032:2015', 'EN 301 489-17', 'EN 300 328', 'IEC 61000-4-2']);
});

test('verdictOf mapping', () => {
  assert.equal(verdictOf('exact_match'), 'ok');
  assert.equal(verdictOf('version_mismatch'), 'check');
  assert.equal(verdictOf('no_match'), 'ng');
});

test('FIX: version-only difference is version_tolerant, not prefix_mismatch (旧: 表記違い(EN :/EN))', () => {
  const r = findScopeMatch('EN 55032:2015', jab);
  assert.equal(r.status, 'version_tolerant_match');
  assert.equal(r.note, 'バージョン包括(2015)');
  assert.equal(findScopeMatch('EN 61000-4-2:2009', a2la).status, 'version_tolerant_match');
});

test('FIX: scope search finds part numbers inside spaced range notation', () => {
  assert.ok(searchInScopes('302 065-2', a2la).some(x => x.match_type === 'range_match'));
  assert.ok(searchInScopes('489-52', a2la).some(x => x.match_type === 'range_match'));
  assert.equal(searchInScopes('302 065-9', a2la).filter(x => x.match_type === 'range_match').length, 0);
});
