import { parseStandardReferences, editionLabel } from './references.js';

const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const referenceOf = value => {
  const refs = typeof value === 'string' && value.length <= 150 ? parseStandardReferences(value) : [];
  requireThat(refs.length === 1 && !refs[0].edition_unparsed, 'One explicit replacement reference is required');
  return refs[0];
};

// Lifecycle belongs to the original reference, not its accreditation or OJ status.
export function validateLifecycle(input, { target, editions, evidence, checked_at }) {
  const published = editions.some(e => e.status === 'published');
  if (!input && published) return { status: 'current' };
  requireThat(input && ['current', 'withdrawn'].includes(input.status), 'Explicit lifecycle confirmation is required when no Published edition exists');
  requireThat(!Array.isArray(input) && Object.keys(input).every(key => ['status','withdrawal_confirmed','withdrawal_date','source_url','replacement_status','replacements'].includes(key)), 'Unknown lifecycle property');
  if (input.status === 'current') {
    requireThat(published, 'A current reference needs a Published edition');
    requireThat(Object.keys(input).every(key => key === 'status'), 'Current lifecycle cannot contain withdrawal metadata');
    return { status: 'current' };
  }
  requireThat(!published && editions.some(e => e.status === 'withdrawn'), 'Withdrawal cannot coexist with current Published editions');
  requireThat(input.withdrawal_confirmed === true, 'Confirm withdrawal of the reference, not merely an old edition');
  const source = url => requireThat(evidence.some(e => e.url === url), 'Lifecycle and replacement URLs need retrieved official evidence');
  source(input.source_url);
  const date = input.withdrawal_date ?? null;
  requireThat(date === null || (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date && date <= checked_at.slice(0, 10)), 'Invalid or future withdrawal date');
  requireThat(['known', 'none', 'unknown'].includes(input.replacement_status), 'Distinguish known replacements, confirmed none, and unknown');
  requireThat(Array.isArray(input.replacements) && input.replacements.length <= 10, 'Provide a bounded replacement list');
  requireThat((input.replacement_status === 'known') === (input.replacements.length > 0), 'Replacement status and list disagree');
  const seen = new Set();
  const replacements = input.replacements.map(item => {
    requireThat(item && !Array.isArray(item) && Object.keys(item).every(key => ['reference','relation','note','source_url'].includes(key)), 'Unknown replacement property');
    const ref = referenceOf(item.reference);
    requireThat(ref.key !== target.key && !seen.has(ref.key), 'Self or duplicate replacement is not allowed');
    seen.add(ref.key);
    requireThat(['full', 'partial'].includes(item.relation), 'Replacement must state full or partial coverage');
    requireThat(typeof item.note === 'string' && item.note.trim().length > 0 && item.note.length <= 1000, 'Explain replacement coverage and conditions');
    source(item.source_url);
    return { key: ref.key, reference: ref.designation,
      // The edition cited by the relationship is NOT the successor latest edition.
      cited_edition: ref.editions.map(editionLabel).join(' / ') || null,
      relation: item.relation, note: item.note.trim(), source_url: item.source_url };
  });
  return { status: 'withdrawn', withdrawal_confirmed: true, withdrawal_date: date,
    source_url: input.source_url, replacement_status: input.replacement_status, replacements };
}

export function isWithdrawnRecord(record, today = new Date().toISOString().slice(0, 10)) {
  return record?.review_schema_version === 2 && record.lifecycle?.status === 'withdrawn'
    && record.lifecycle.withdrawal_confirmed === true && Number.isFinite(Date.parse(record.checked_at))
    && (!record.lifecycle.withdrawal_date || record.lifecycle.withdrawal_date <= today)
    && record.editions?.some(e => e.status === 'withdrawn')
    && !record.editions.some(e => e.status === 'published');
}

export function lifecycleState(record) {
  if (isWithdrawnRecord(record)) {
    const lifecycle = record.lifecycle;
    return { status: 'withdrawn', withdrawal_date: lifecycle.withdrawal_date,
      replacement_status: lifecycle.replacement_status,
      replacements: lifecycle.replacements.map(({ key, reference, cited_edition, relation, note }) =>
        ({ key, reference, cited_edition, relation, note })).sort((a, b) => a.key.localeCompare(b.key)) };
  }
  return { status: record?.editions?.some(e => e.status === 'published') ? 'current' : 'unknown' };
}
