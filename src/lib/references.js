// Structured references shared by scope checks and publisher catalogues.
// Keep regional adoptions separate; only spelling aliases share an identity.
const PREFIX = /\b(?:ETSI\s+(?:EN|TS|ES|TR|GS)|EN\s+ISO(?:\s*\/\s*IEC)?|EN\s+IEC|ISO\s*\/\s*IEC|KS\s+[A-Z](?:\s+IEC)?|JIS\s+[A-Z]|VCCI[-\s]CISPR|VCCI(?:\s+rule)?|ANSI(?:\s*\/\s*(?:IEEE|USEMCSC))?|IEEE(?:\s*\/\s*ANSI)?|CISPR|IEC|ISO|EN|RSS|ICES|UNII|MP|FCC\s+KDB|AS\s*\/\s*NZS|SEMI)\s*[- ]?\s*(?=[A-Z]?-?\d|GEN\b|MP\b)/gi;

export const unique = values => [...new Set(values.filter(v => v !== null && v !== undefined && v !== ''))];

export function publisherOf(namespace, number) {
  if (namespace === 'EN' && /^3\d{5}(?:-|$)/.test(number.replace(/\s/g, ''))) return 'etsi';
  if (namespace.startsWith('ETSI')) return 'etsi';
  if (namespace.startsWith('EN')) return 'cenelec';
  if (['IEC', 'CISPR'].includes(namespace)) return 'iec';
  if (namespace.startsWith('ISO')) return 'iso';
  if (namespace === 'ANSI') return 'ieee';
  if (['RSS', 'ICES'].includes(namespace)) return 'ised';
  if (namespace.startsWith('JIS')) return 'jisc';
  if (namespace.startsWith('KS')) return 'ks';
  if (namespace.startsWith('VCCI')) return 'vcci';
  if (['MP', 'UNII', 'FCC KDB'].includes(namespace)) return 'fcc';
  return 'manual';
}

function normalizeNamespace(prefix) {
  const p = prefix.toUpperCase().replace(/\s+/g, ' ').trim();
  if (p === 'ETSI EN') return 'EN';
  if (p === 'EN IEC') return 'EN IEC';
  if (/^(ANSI|IEEE)/.test(p)) return 'ANSI';
  if (/^ISO\s*\//.test(p)) return 'ISO/IEC';
  return p.replace(/\s*\/\s*/g, '/').replace('VCCI-CISPR', 'VCCI CISPR').replace('VCCI RULE', 'VCCI');
}

export function compareVersions(a, b) {
  const parts = v => {
    const s = String(v || '').replace(/[()]/g, '').trim();
    if (/^\d{4}$/.test(s)) return ['year', [Number(s)]];
    const m = s.match(/^(V|Issue\s*|Ed\.?\s*)(\d+(?:\.\d+)*)$/i);
    return m ? [m[1].toLowerCase().replace(/[.\s]/g, ''), m[2].split('.').map(Number)] : null;
  };
  const x = parts(a), y = parts(b);
  if (!x || !y || x[0] !== y[0]) return null;
  for (let i = 0; i < Math.max(x[1].length, y[1].length); i++) {
    const d = (x[1][i] || 0) - (y[1][i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

export function parseEditions(suffix) {
  const s = String(suffix || '');
  const v = s.match(/^\s*:?\s*(V\d+(?:\.\d+){0,3})(?:\s*\/\s*(V\d+(?:\.\d+){0,3}))*/i);
  const years = s.match(/^\s*[:\-]\s*(\d{4}(?:\s*\/\s*\d{4})*)/) || s.match(/^\s*\((\d{4})\)/);
  const issue = s.match(/^\s*[,;:]?\s*(?:Issue|Ed(?:ition)?\.?)\s*(\d+(?:\.\d+)*)/i);
  const bases = v ? v[0].match(/V\d+(?:\.\d+)*/gi).map(n => n.toUpperCase())
    : years ? years[1].split(/\s*\/\s*/)
      : issue ? [`${/Issue/i.test(issue[0]) ? 'Issue' : 'Ed'} ${issue[1]}`] : [];
  const amendments = [], corrections = [];
  for (const m of s.matchAll(/(?:\+|\/|\b)(AMD|A|AC|COR(?:RIGENDUM)?\.?)\s*(\d*)\s*[:\-]?\s*(\d{4})?/gi)) {
    const correction = /^(AC|COR)/i.test(m[1]);
    const token = `${correction ? 'COR' : 'A'}${m[2]}${m[3] ? ':' + m[3] : ''}`;
    (correction ? corrections : amendments).push(token);
  }
  // A following amendment applies to the last edition in an explicit list.
  const editions = bases.map((base, i) => ({ base, amendments: i === bases.length - 1 ? unique(amendments) : [], corrections: i === bases.length - 1 ? unique(corrections) : [] }));
  const unparsed = !bases.length && /^\s*(?:[:(]|V\d|Issue\b|Ed\b)/i.test(s);
  return { editions, versions: bases, edition_unparsed: unparsed };
}

export function parseStandardReferences(text) {
  const raw = String(text || '').replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\u00a0/g, ' ');
  const matches = [...raw.matchAll(PREFIX)];
  const refs = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const prefix = m[0].replace(/[-\s]+$/, '');
    const namespace = normalizeNamespace(prefix);
    const body = raw.slice(m.index + m[0].length, matches[i + 1]?.index ?? raw.length);
    const nm = body.match(/^(?:GEN\b|MP\b|[A-Z]?-?\d+(?:\.\d+)*(?:-\d+)*(?:\s+\d{3}(?:-\d+)*)?)/i);
    if (!nm) continue;
    let number = nm[0].toUpperCase().replace(/\s+/g, ' ').trim();
    let suffix = body.slice(nm[0].length);
    if (['RSS', 'ICES'].includes(namespace)) {
      const subpart = suffix.match(/^(?:\.[A-Z][A-Z0-9]*)+/i);
      if (subpart) { number += subpart[0].toUpperCase(); suffix = suffix.slice(subpart[0].length); }
    }
    // ANSI uses a hyphen before the year; do not mistake it for a part number.
    const yearTail = number.match(/-(\d{4})$/);
    if (yearTail && ['ANSI', 'SEMI'].includes(namespace)) {
      number = number.slice(0, -5);
      suffix = ':' + yearTail[1] + suffix;
    }
    if (namespace === 'FCC KDB') {
      const doc = suffix.match(/^\s+(D\d+)\b/i);
      if (doc) { number += ' ' + doc[1].toUpperCase(); suffix = suffix.slice(doc[0].length); }
    }
    const range = suffix.match(/^(?:\s*\/\s*-\d+)+/);
    const numbers = [number];
    if (range) {
      for (const part of range[0].matchAll(/-(\d+)/g)) numbers.push(number.replace(/-\d+$/, '') + '-' + part[1]);
      suffix = suffix.slice(range[0].length);
    }
    const editions = parseEditions(suffix);
    for (const n of numbers) refs.push({
      key: `${namespace}:${n.replace(/\s/g, '')}`, namespace, number: n,
      designation: `${namespace}${['RSS', 'ICES', 'MP', 'UNII'].includes(namespace) ? '-' : ' '}${n}`,
      provider: publisherOf(namespace, n), ...editions,
    });
  }
  const grouped = new Map();
  for (const ref of refs) {
    const existing = grouped.get(ref.key);
    if (!existing) grouped.set(ref.key, ref);
    else {
      existing.editions.push(...ref.editions);
      existing.versions = unique([...existing.versions, ...ref.versions]);
      existing.edition_unparsed ||= ref.edition_unparsed;
    }
  }
  return [...grouped.values()];
}

export function editionLabel(edition) {
  return [edition.base, ...(edition.amendments || []), ...(edition.corrections || [])].join('+');
}

export function coversEdition(scope, target) {
  return scope.base === target.base
    && (target.amendments || []).every(a => scope.amendments.includes(a))
    && (target.corrections || []).every(a => scope.corrections.includes(a));
}

// Separate publications of amendments belong to the same base, not alternative editions.
export function mergeEditions(editions) {
  const merged = new Map();
  for (const e of editions) {
    const old = merged.get(e.base) || { base: e.base, amendments: [], corrections: [] };
    old.amendments = unique([...old.amendments, ...(e.amendments || [])]);
    old.corrections = unique([...old.corrections, ...(e.corrections || [])]);
    merged.set(e.base, old);
  }
  return [...merged.values()];
}
