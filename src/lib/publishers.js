import { parseStandardReferences, editionLabel, mergeEditions } from './references.js';

const OFFICIAL = ['etsi.org', 'cencenelec.eu', 'iec.ch', 'iso.org', 'ieee.org', 'ansi.org', 'ised-isde.canada.ca', 'standard.go.kr', 'jisc.go.jp', 'vcci.jp', 'fcc.gov', 'ecfr.gov', 'semi.org', 'standards.org.au', 'standards.govt.nz'];
export function officialUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443')
      && OFFICIAL.some(h => u.hostname === h || u.hostname.endsWith('.' + h));
  } catch { return false; }
}

export async function fetchOfficial(url, init = {}) {
  let target = url;
  for (let i = 0; i < 5; i++) {
    if (!officialUrl(target)) throw new Error('Unapproved source URL');
    const response = await fetch(target, { ...init, redirect: 'manual', signal: AbortSignal.timeout(18000) });
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      const next = new URL(response.headers.get('location'), target).href;
      if (new URL(next).origin !== new URL(target).origin) init = {}; // never forward cookies to another origin
      if (response.status === 303 || response.status === 302) init = { headers: init.headers };
      target = next;
      continue;
    }
    if (!response.ok) throw new Error(`Source HTTP ${response.status}`);
    const reader = response.body.getReader();
    let length = 0, text = ''; const decoder = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 2500000) { await reader.cancel(); throw new Error('Source response exceeds size limit'); }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally { reader.releaseLock(); }
    return { text, url: target, headers: response.headers };
  }
  throw new Error('Too many source redirects');
}

export function decodeHtml(s) {
  return String(s || '').replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
export const plainText = html => decodeHtml(String(html).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
export function links(html, base) {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m => {
    try { return { url: new URL(decodeHtml(m[1]), base).href, label: plainText(m[2]) }; } catch { return null; }
  }).filter(Boolean);
}
function resultEdition(designation, key, metadata = {}) {
  const ref = parseStandardReferences(designation).find(r => r.key === key);
  if (!ref || ref.edition_unparsed || !ref.editions.length) return null;
  return { designation, edition: ref.editions.at(-1), status: 'published', publication_date: null, ...metadata };
}

export const SEARCH_URLS = {
  etsi: r => 'https://www.etsi.org/standards#search=' + encodeURIComponent(r.designation) + '&published=1&onApproval=0',
  cenelec: () => 'https://standards.cencenelec.eu/ords/f?p=CEN:105',
  iec: r => 'https://webstore.iec.ch/en/catalogsearch/result/?q=' + encodeURIComponent(r.designation),
  iso: r => 'https://www.iso.org/search.html?q=' + encodeURIComponent(r.designation),
  ieee: r => 'https://standards.ieee.org/search/?q=' + encodeURIComponent(r.number),
  ised: r => r.namespace === 'RSS'
    ? 'https://ised-isde.canada.ca/site/spectrum-management-telecommunications/en/devices-and-equipment/radio-equipment-standards/radio-standards-specifications-rss'
    : 'https://ised-isde.canada.ca/site/spectrum-management-telecommunications/en/devices-and-equipment/interference-causing-equipment-standards-ices',
  jisc: () => 'https://www.jisc.go.jp/app/jis/general/GnrJISSearch.html',
  ks: () => 'https://standard.go.kr/KSCI/standardIntro/getStandardSearchList.do',
  vcci: () => 'https://www.vcci.jp/english/member/index.html',
  fcc: () => 'https://apps.fcc.gov/oetcf/kdb/index.cfm',
  semi: () => 'https://store-us.semi.org/',
  as_nzs: () => 'https://www.standards.govt.nz/',
};

export function parseEtsi(rows, ref) {
  if (!Array.isArray(rows)) throw new Error('Unexpected ETSI response');
  return rows.filter(r => r.ACTION_TYPE === 'PU' && String(r.IsCurrent) === '1' && String(r.superseded) === '0')
    .map(r => resultEdition(r.ETSI_DELIVERABLE, ref.key, { source_url: 'https://www.etsi.org/deliver/' + r.EDSpathname + r.EDSPDFfilename }))
    .filter(Boolean);
}

const attr = (tag, name) => decodeHtml(tag.match(new RegExp('\\b' + name + '=["\x27]([^"\x27]*)["\x27]', 'i'))?.[1] || '');
export function cenForm(html, reference) {
  const form = html.match(/<form\b[^>]*id="wwvFlowForm"[^>]*>([\s\S]*?)<\/form>/i);
  if (!form) throw new Error('CEN search form changed');
  const body = new URLSearchParams();
  for (const match of form[1].matchAll(/<input\b[^>]*>|<select\b[^>]*>[\s\S]*?<\/select>/gi)) {
    const tag = match[0], name = attr(tag, 'name'), type = attr(tag, 'type');
    if (!name || type === 'submit' || type === 'button') continue;
    if (type === 'checkbox' && !['S6', 'CEN', 'CLC'].includes(attr(tag, 'value'))) continue;
    let value = attr(tag, 'value');
    if (/^<select/i.test(tag)) {
      const options = [...tag.matchAll(/<option\b([^>]*)>/gi)];
      value = attr(options.find(o => /\bselected\b/i.test(o[1]))?.[0] || options[0]?.[0] || '', 'value');
    }
    if (attr(tag, 'id') === 'STAND_REF') value = reference;
    body.append(name, value);
  }
  body.set('p_request', 'S6-CEN-CLC-');
  body.set('p_reload_on_submit', 'S');
  return { action: attr(form[0].slice(0, form[0].indexOf('>')), 'action'), body };
}

export function parseCen(html, ref, base) {
  const out = [];
  for (const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const text = plainText(tr[1]);
    if (!/\bPublished\b/i.test(text) || /\bWithdrawn\b/i.test(text)) continue;
    for (const link of links(tr[1], base)) {
      const candidate = parseStandardReferences(link.label)[0];
      const adoptionChange = candidate && candidate.number === ref.number && candidate.provider === 'cenelec' && candidate.key !== ref.key;
      const item = resultEdition(link.label, adoptionChange ? candidate.key : ref.key, { source_url: link.url, reference_changed: !!adoptionChange });
      if (item) out.push(item);
    }
  }
  const grouped = new Map();
  for (const e of out) {
    const key = parseStandardReferences(e.designation)[0].key + ':' + e.edition.base;
    const old = grouped.get(key);
    if (!old) grouped.set(key, e);
    else {
      old.edition = mergeEditions([old.edition, e.edition])[0];
      old.designation = parseStandardReferences(old.designation)[0].designation + ':' + editionLabel(old.edition);
      old.source_urls = [...new Set([...(old.source_urls || [old.source_url]), e.source_url])];
    }
  }
  return [...grouped.values()];
}
async function cenelec(ref) {
  const page = await fetchOfficial(SEARCH_URLS.cenelec(ref));
  const { action, body } = cenForm(page.text, ref.number);
  const cookie = (page.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
  let result = await fetchOfficial(new URL(action, page.url).href, { method: 'POST', body: body.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(cookie ? { Cookie: cookie } : {}) } });
  if (result.text.trim().startsWith('{')) {
    const next = JSON.parse(result.text).redirectURL;
    if (!next) throw new Error('CEN search submission failed');
    result = await fetchOfficial(new URL(decodeHtml(next), result.url).href, { headers: cookie ? { Cookie: cookie } : {} });
  }
  return { editions: parseCen(result.text, ref, result.url), source_url: SEARCH_URLS.cenelec(ref) };
}
async function etsi(ref) {
  const url = new URL('https://www.etsi.org/custom/standardssearch/data.php');
  const params = { format: 'json', page: 1, search: ref.designation, title: 0, etsiNumber: 1, content: 0, version: 1,
    onApproval: 0, published: 1, withdrawn: 0, historical: 0, isCurrent: 1, superseded: 0,
    startDate: '1988-01-15', endDate: new Date().toISOString().slice(0, 10), harmonized: 0, sort: 1 };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const { text } = await fetchOfficial(url.href);
  const rows = JSON.parse(text);
  if (Number(rows[0]?.total_count) > rows.length) throw new Error('ETSI search incomplete; narrow the reference');
  return { editions: parseEtsi(rows, ref), source_url: SEARCH_URLS.etsi(ref) };
}

export function parseIec(data, ref) {
  const hits = data.primary?.hits;
  if (!Array.isArray(hits?.hits)) throw new Error('Unexpected IEC search response');
  if (hits.total?.relation !== 'eq' || hits.total.value > hits.hits.length) throw new Error('IEC search incomplete; narrow the reference');
  const entries = new Map();
  for (const hit of hits.hits) {
    const s = hit._source;
    // Ignore previews, draft/PRV documents and sales bundles. Lifecycle holds base + amendments.
    for (const e of [s, ...(s.lifecycle || [])]) {
      if (e.status !== 'PUBLISHED' || /\b(PRV|SER|PACK)\b|Edition\s+\d/i.test(e.reference || '')) continue;
      const item = resultEdition(e.reference, ref.key, { publication_date: e.publication_date || null, source_url: 'https://webstore.iec.ch/en/publication/' + e.id, publisher_edition: e.edition || null });
      if (!item) continue;
      const key = editionLabel(item.edition);
      if (!entries.has(key) || !/\b(RLV|CMV)\b/.test(item.designation)) entries.set(key, item);
    }
  }
  // A separate amendment/corrigendum has to be applied to the same base edition.
  const bases = new Map();
  for (const e of entries.values()) {
    const old = bases.get(e.edition.base);
    if (!old) bases.set(e.edition.base, structuredClone(e));
    else {
      old.edition.amendments = [...new Set([...old.edition.amendments, ...e.edition.amendments])];
      old.edition.corrections = [...new Set([...old.edition.corrections, ...e.edition.corrections])];
      old.designation = ref.designation + ':' + editionLabel(old.edition);
    }
  }
  return [...bases.values()];
}
async function iec(ref) {
  const body = { mode: 'FULL', query: ref.designation, from: 0, size: 100, validOnly: true,
    sortBy: [{ reference: 'asc' }], language: 'en', dateRanges: {}, terms: {}, showTrf: false, collapsed: false };
  const { text } = await fetchOfficial('https://webstore-search-api.iec.ch/api/search', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { editions: parseIec(JSON.parse(text), ref), source_url: SEARCH_URLS.iec(ref) };
}

export function parseIsed(html, ref, url) {
  const text = plainText(html);
  // The document header, not the "replaces issue ..." sentence or footer date.
  const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (!heading || !parseStandardReferences(plainText(heading[1])).some(r => r.key === ref.key)) throw new Error('ISED reference not confirmed');
  const start = text.indexOf(plainText(heading[1]));
  const header = text.slice(start, start + 650).split(/Preface|Contents|Table of contents/i)[0];
  const issue = header.match(/Issue\s+(\d+)/i);
  if (!issue) throw new Error('ISED issue not found in document header');
  const amendment = header.match(/Amendment\s+(\d+)/i);
  const edition = { base: 'Issue ' + issue[1], amendments: amendment ? ['A' + amendment[1]] : [], corrections: [] };
  return [{ designation: ref.designation + ' ' + editionLabel(edition), edition, status: 'published', source_url: url, publication_date: null }];
}
async function ised(ref) {
  const root = SEARCH_URLS.ised(ref);
  const index = await fetchOfficial(root);
  let candidates = links(index.text, index.url);
  const table = index.text.match(/<table\b[^>]*data-wb-tables=["'][\s\S]*?>/i)?.[0];
  if (table) {
    const settings = JSON.parse(attr(table, 'data-wb-tables'));
    if (settings.ajaxSource) {
      const listing = await fetchOfficial(new URL(settings.ajaxSource, index.url).href);
      const rows = JSON.parse(listing.text).data;
      if (!Array.isArray(rows)) throw new Error('Unexpected ISED index format');
      candidates = rows.filter(r => r.Type === ref.namespace).flatMap(r => links(r.Title || '', listing.url));
    }
  }
  const target = candidates.find(l => parseStandardReferences(l.label).some(r => r.key === ref.key) && !/\.pdf(?:$|\?)/i.test(l.url));
  if (!target) throw new Error('ISED document link not found');
  const page = await fetchOfficial(target.url);
  return { editions: parseIsed(page.text, ref, page.url), source_url: page.url };
}

export const AUTOMATIC_PROVIDERS = ['etsi', 'cenelec', 'iec', 'ised'];
export async function fetchPublisher(ref) {
  let result;
  if (ref.provider === 'etsi') result = await etsi(ref);
  else if (ref.provider === 'cenelec') result = await cenelec(ref);
  else if (ref.provider === 'iec') result = await iec(ref);
  else if (ref.provider === 'ised') result = await ised(ref);
  // A Published label on a fixed old detail page does not establish the latest edition.
  else throw new Error('Manual verification required for this publisher');
  if (!result.editions.length) throw new Error('No exact current Published edition confirmed');
  return { ...result, key: ref.key, designation: ref.designation, provider: ref.provider, checked_at: new Date().toISOString(), origin: 'automatic' };
}
