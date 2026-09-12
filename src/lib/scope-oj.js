import { parseStandardReferences, compareVersions, unique, coversEdition, mergeEditions } from './references.js';

export const compareEditionVersions = compareVersions;
export const normalizeOjNumber = value => String(value || '').replace(/\s*,?\s*[\r\n]+\s*/g, ' / ').trim();
export function isActiveOjEntry(entry, today) {
  const start = entry.date_of_start_presumption;
  return (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start) || start <= today)
    && (!entry.withdrawal_date || entry.withdrawal_date > today);
}

export function assessEditions(ref, targets, kind = 'oj') {
  if (ref.edition_unparsed || targets.some(t => t.edition_unparsed)) return { status: 'unverified', reason: 'version_not_comparable' };
  if (kind === 'oj' && targets.some(t => !t.editions.length)) return { status: 'valid', reason: 'oj_version_unavailable' };
  if (!ref.editions.length) return { status: 'caution', reason: 'scope_version_missing' };
  const editions = targets.flatMap(t => t.editions);
  if (!editions.length) return { status: 'unverified', reason: 'version_not_comparable' };
  for (const e of editions) {
    if (ref.editions.some(s => coversEdition(s, e))) return { status: 'valid', reason: 'version_match', matched_version: e.base };
  }
  if (editions.some(e => ref.editions.some(s => s.base === e.base))) return { status: 'caution', reason: 'amendments_missing' };
  const comparisons = ref.editions.flatMap(s => editions.map(e => compareVersions(s.base, e.base)));
  if (comparisons.every(c => c !== null && c < 0)) return { status: 'warning', reason: 'scope_version_old' };
  if (comparisons.some(c => c !== null && c > 0)) return { status: 'caution', reason: 'scope_version_newer' };
  return { status: 'unverified', reason: 'version_not_comparable' };
}

function ojView(entry, today) {
  const raw = entry.full_number || entry.number || '';
  const references = parseStandardReferences(raw).map(r => ({ ...r, editions: mergeEditions(r.editions) }));
  return { ...entry, number: normalizeOjNumber(raw), active: entry.active !== false && isActiveOjEntry(entry, today), references };
}

export function checkScopeAgainstOj(scopeStandard, ojEntries, today) {
  const ref = typeof scopeStandard === 'string' ? parseStandardReferences(scopeStandard)[0] : scopeStandard;
  const entries = (ojEntries || []).map(e => ojView(e, today));
  const active = entries.filter(e => e.active);
  const targets = active.flatMap(e => e.references.filter(r => r.key === ref?.key));
  const versions = unique(targets.flatMap(t => t.versions));
  const base = {
    scope_version: ref?.versions.join(' / ') || null, scope_versions: ref?.versions || [],
    oj_status: active.length ? 'active' : entries.length ? 'withdrawn' : 'not_listed',
    oj_versions: versions, oj_latest_version: versions.reduce((a, b) => !a || compareVersions(b, a) > 0 ? b : a, null),
    oj_numbers: unique(active.map(e => e.number)), oj_directives: unique(active.map(e => e.directive)),
    oj_entries: active.map(({ references, ...e }) => ({ ...e, version: references.filter(r => r.key === ref?.key).flatMap(r => r.versions).join(' / ') || null })),
  };
  if (!ref) return { ...base, status: 'unverified', reason: 'reference_unknown' };
  if (!active.length) return { ...base, status: 'not_listed', reason: entries.length ? 'oj_withdrawn' : 'oj_not_listed' };
  if (!targets.length) return { ...base, status: 'unverified', reason: 'reference_unknown' };
  // EC can list the base and its amendments in separate rows. They are not
  // interchangeable alternatives; preserve coexistence only across base editions.
  const combined = targets.some(t => !t.editions.length) ? targets : [{
    editions: mergeEditions(targets.flatMap(t => t.editions)),
    edition_unparsed: targets.some(t => t.edition_unparsed),
  }];
  return { ...base, ...assessEditions(ref, combined) };
}

export function aggregateChecks(checks) {
  const order = ['warning', 'unverified', 'caution', 'valid', 'not_listed'];
  for (const status of order) {
    const found = checks.find(c => c.status === status);
    if (found) return { status, reason: found.reason };
  }
  return { status: 'unverified', reason: 'reference_unknown' };
}

export function checkPublished(ref, record, today) {
  const base = { record: record || null };
  if (!record?.editions?.length) return { ...base, status: 'unverified', reason: record?.error ? 'fetch_failed' : 'catalog_missing' };
  const current = record.editions.filter(e => e.status === 'published' && (!e.publication_date || e.publication_date <= today));
  if (!current.length) return { ...base, status: 'unverified', reason: 'published_missing' };
  // Normative edition numbers, not webpage update dates / reaffirmation dates.
  let latest = current[0];
  for (const e of current.slice(1)) {
    const cmp = compareVersions(e.edition.base, latest.edition.base);
    if (cmp === null && e.edition.base !== latest.edition.base) return { ...base, status: 'unverified', reason: 'version_not_comparable' };
    if (cmp > 0 || (cmp === 0 && (e.edition.amendments.length + e.edition.corrections.length > latest.edition.amendments.length + latest.edition.corrections.length))) latest = e;
  }
  const checked = assessEditions(ref, [{ editions: [latest.edition] }], 'published');
  if (latest.reference_changed) Object.assign(checked, { status: 'caution', reason: 'reference_changed' });
  // Verification dates are displayed for context, not used as an expiry timer.
  // Missing verification metadata and actual fetch failures still need review.
  const invalidCheckedAt = !Number.isFinite(Date.parse(record.checked_at));
  return { ...base, ...checked, latest, ...(record.error || invalidCheckedAt ? {
    status: 'unverified', reason: record.error ? 'fetch_failed' : 'verification_date_invalid',
  } : {}) };
}

const counts = checks => Object.fromEntries(['valid', 'warning', 'caution', 'not_listed', 'unverified'].map(s => [s, checks.filter(c => c.status === s).length]));

export function buildScopeOjVersionCheck(scopeDocuments, standardsByDirective, today = new Date().toISOString().slice(0, 10), options = {}) {
  const index = new Map();
  const directives = options.directive && options.directive !== 'ALL' ? [options.directive] : ['RED', 'EMC', 'LVD'];
  for (const directive of directives) for (const entry of standardsByDirective[directive] || []) {
    for (const ref of parseStandardReferences(entry.full_number || entry.number)) {
      const key = directive + '|' + ref.key;
      index.set(key, [...(index.get(key) || []), { ...entry, directive }]);
    }
  }
  const catalog = new Map((options.catalog || []).map(r => [r.key, r]));
  const items = [];
  for (const { certType, doc, source } of scopeDocuments) {
    const facilities = new Map((doc.facilities || []).map(f => [f.facility_number, f]));
    for (const scope of doc.items || []) {
      const refs = parseStandardReferences(scope.standard);
      const references = refs.map(ref => {
        const checks = directives.map(d => {
          const entries = index.get(d + '|' + ref.key) || [];
          if (options.ojErrors?.[d] && ref.namespace.startsWith('EN')) return { directive: d, status: 'unverified', reason: 'fetch_failed', oj_entries: [] };
          return { directive: d, ...checkScopeAgainstOj(ref, entries, today) };
        });
        const relevant = checks.filter(c => c.status !== 'not_listed');
        return { ...ref, oj: { ...aggregateChecks(relevant.length ? relevant : checks), checks }, published: checkPublished(ref, catalog.get(ref.key), today) };
      });
      const oj = aggregateChecks(references.map(r => r.oj));
      const published = aggregateChecks(references.map(r => r.published));
      const ojEntries = references.flatMap(r => r.oj.checks.flatMap(c => c.oj_entries || []));
      const ojVersions = unique(references.flatMap(r => r.oj.checks.flatMap(c => c.oj_versions || [])));
      const facility = facilities.get(scope.facility_number);
      items.push({ cert_type: certType, certificate_number: doc.info?.certificate_number || null,
        valid_until: doc.info?.valid_until || null, organization: doc.info?.organization || null, source,
        facility_number: scope.facility_number || null, facility_name: facility?.name || null, facility_location: facility?.location || null,
        category: scope.category || null, anchor: scope.anchor || null, standard: scope.standard, description: scope.description || '', references,
        scope_versions: unique(refs.flatMap(r => r.versions)), scope_version: unique(refs.flatMap(r => r.versions)).join(' / ') || null,
        ...oj, published, oj_entries: ojEntries, oj_numbers: unique(ojEntries.map(e => e.number)),
        oj_versions: ojVersions,
        oj_latest_version: refs.length === 1 ? ojVersions.reduce((a, b) => !a || compareVersions(b, a) > 0 ? b : a, null) : null,
        oj_status: ojEntries.length ? 'active' : references.some(r => r.oj.checks.some(c => c.oj_status === 'withdrawn')) ? 'withdrawn' : 'not_listed',
        oj_directives: unique(ojEntries.map(e => e.directive)),
      });
    }
  }
  return { checked_at: new Date().toISOString(), today, directive: options.directive || 'ALL', items,
    summary: { total: items.length, ...counts(items), oj_active: items.filter(i => i.oj_status === 'active').length },
    published_summary: { total: items.length, ...counts(items.map(i => i.published)) },
  };
}
