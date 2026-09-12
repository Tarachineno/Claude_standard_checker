// 現行の認定スコープと、OJに掲載されている有効版数の突合ロジック。
// OJの getStandards() と認定スコープの loadScopeDocument() を組み合わせて使う。

import { extractStandardCore, extractVersion } from './matcher.js';

const VERSION_YEAR_RE = /^\(?\d{4}\)?$/;
const VERSION_SEMVER_RE = /^V\d+(?:\.\d+){2}$/i;

/** OJの取下げ日が未到来、または未記載なら有効とする（quick-check と同じ判定）。 */
export function isActiveOjEntry(entry, today) {
  return !entry.withdrawal_date || entry.withdrawal_date > today;
}

/** Excel内の改行・カンマ区切りを画面表示用に整える。 */
export function normalizeOjNumber(value) {
  return String(value || '').replace(/\s*,?\s*[\r\n]+\s*/g, ' / ').trim();
}

function parseComparableVersion(value) {
  const version = String(value || '').trim();
  if (VERSION_YEAR_RE.test(version)) return { kind: 'year', values: [Number(version.replace(/[()]/g, ''))] };
  if (VERSION_SEMVER_RE.test(version)) return { kind: 'semver', values: version.slice(1).split('.').map(Number) };
  return null;
}

/** 同じ形式（年版同士、V版同士）の版数を比較する。比較不能なら null。 */
export function compareEditionVersions(left, right) {
  const a = parseComparableVersion(left);
  const b = parseComparableVersion(right);
  if (!a || !b || a.kind !== b.kind) return null;
  const length = Math.max(a.values.length, b.values.length);
  for (let i = 0; i < length; i++) {
    const av = a.values[i] || 0;
    const bv = b.values[i] || 0;
    if (av !== bv) return av < bv ? -1 : 1;
  }
  return 0;
}

function latestComparableVersion(versions, preferredKind = null) {
  const candidates = preferredKind
    ? versions.filter(version => parseComparableVersion(version)?.kind === preferredKind)
    : versions;
  return candidates.reduce((latest, version) => {
    if (!latest) return version;
    const comparison = compareEditionVersions(version, latest);
    return comparison !== null && comparison > 0 ? version : latest;
  }, '');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function entryVersion(entry) {
  return entry.version || extractVersion(entry.number || entry.full_number) || null;
}

function ojEntryView(entry, directive, today) {
  const number = entry.number || entry.full_number || '';
  return {
    directive,
    number: normalizeOjNumber(number),
    version: extractVersion(number) || null,
    date: entry.date || null,
    oj_reference: entry.oj_reference || null,
    withdrawal_date: entry.withdrawal_date || null,
    active: isActiveOjEntry(entry, today),
  };
}

function createOjIndex(standardsByDirective, today) {
  const index = new Map();
  for (const [directive, standards] of Object.entries(standardsByDirective || {})) {
    for (const standard of standards || []) {
      const number = standard.number || standard.full_number || '';
      const core = extractStandardCore(number);
      if (!core) continue;
      const list = index.get(core) || [];
      list.push(ojEntryView(standard, directive, today));
      index.set(core, list);
    }
  }
  return index;
}

/** 1つの認定スコープ項目をOJの有効掲載と突合する。 */
export function checkScopeAgainstOj(scopeStandard, ojEntries, today) {
  const scopeVersion = extractVersion(scopeStandard) || null;
  const allEntries = ojEntries || [];
  const activeEntries = allEntries.filter(entry => entry.active ?? isActiveOjEntry(entry, today));
  const ojVersions = unique(activeEntries.map(entryVersion));
  const ojNumbers = unique(activeEntries.map(entry => entry.number));
  const ojDirectives = unique(activeEntries.map(entry => entry.directive));
  const base = {
    scope_version: scopeVersion,
    oj_status: activeEntries.length ? 'active' : allEntries.length ? 'withdrawn' : 'not_listed',
    oj_versions: ojVersions,
    oj_latest_version: latestComparableVersion(ojVersions) || null,
    oj_numbers: ojNumbers,
    oj_directives: ojDirectives,
    oj_entries: activeEntries,
  };

  if (!activeEntries.length) {
    return {
      ...base,
      status: 'not_listed',
      reason: allEntries.length ? 'oj_withdrawn' : 'oj_not_listed',
    };
  }

  // OJに版数の記載がない場合は、認定スコープ側の版数に関係なく有効。
  if (!ojVersions.length) {
    return { ...base, status: 'valid', reason: 'oj_version_unavailable' };
  }

  // OJは版数あり、認定スコープは版数なし。最新版が自動適用されるため注意。
  if (!scopeVersion) {
    return { ...base, status: 'caution', reason: 'scope_version_missing' };
  }

  const scopeKind = parseComparableVersion(scopeVersion)?.kind || null;
  const latestForScope = latestComparableVersion(ojVersions, scopeKind) || base.oj_latest_version;
  const comparison = latestForScope ? compareEditionVersions(scopeVersion, latestForScope) : null;
  if (comparison === 0) {
    return { ...base, status: 'valid', reason: 'version_match' };
  }

  if (comparison !== null && comparison < 0) {
    return { ...base, status: 'warning', reason: 'scope_version_old' };
  }
  if (comparison !== null && comparison > 0) {
    return { ...base, status: 'caution', reason: 'scope_version_newer' };
  }
  return { ...base, status: 'caution', reason: 'version_not_comparable' };
}

/** 現行の認定スコープ全件をOJ有効版数と突合する。 */
export function buildScopeOjVersionCheck(scopeDocuments, standardsByDirective, today = new Date().toISOString().slice(0, 10)) {
  const ojIndex = createOjIndex(standardsByDirective, today);
  const items = [];
  for (const { certType, doc, source } of scopeDocuments) {
    const facilityMap = new Map((doc.facilities || []).map(f => [f.facility_number, f]));
    for (const scope of doc.items || []) {
      const core = extractStandardCore(scope.standard);
      const checked = checkScopeAgainstOj(scope.standard, core ? ojIndex.get(core) || [] : [], today);
      const facility = scope.facility_number ? facilityMap.get(scope.facility_number) : null;
      items.push({
        cert_type: certType,
        certificate_number: doc.info?.certificate_number || null,
        valid_until: doc.info?.valid_until || null,
        organization: doc.info?.organization || null,
        source,
        facility_number: scope.facility_number || null,
        facility_name: facility?.name || null,
        facility_location: facility?.location || null,
        category: scope.category || null,
        anchor: scope.anchor || null,
        standard: scope.standard,
        core: core || null,
        ...checked,
      });
    }
  }

  const summary = {
    total: items.length,
    valid: items.filter(item => item.status === 'valid').length,
    warning: items.filter(item => item.status === 'warning').length,
    caution: items.filter(item => item.status === 'caution').length,
    not_listed: items.filter(item => item.status === 'not_listed').length,
    oj_active: items.filter(item => item.oj_status === 'active').length,
  };
  return { checked_at: new Date().toISOString(), today, items, summary };
}
