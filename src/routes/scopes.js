// 認定スコープまわり: /certificate-data /parse-md-scopes /scope-matcher /scope-search /scopes/status /certificate
import { Hono } from 'hono';
import { ok, fail } from '../lib/http.js';
import { loadScopes, loadCertificateData, loadScopeDocument, scopeStatus, CERT_TYPES } from '../lib/scopes.js';
import { toMatcherScopes } from '../lib/md.js';
import { findScopeMatch, searchInScopes } from '../lib/matcher.js';
import { buildScopeOjVersionCheck } from '../lib/scope-oj.js';
import { getStandards, DIRECTIVES } from '../lib/standards.js';

const app = new Hono();

const certTypeOf = c => {
  const t = (c.req.query('cert_type') || '').toLowerCase();
  return CERT_TYPES.includes(t) ? t : null;
};

// GET /api/certificate-data?cert_type=a2la|jab
app.get('/certificate-data', async c => {
  const certType = certTypeOf(c);
  if (!certType) return fail(c, 400, 'Invalid cert_type. Must be "a2la" or "jab"');
  try {
    return ok(c, await loadCertificateData(c, certType));
  } catch (err) {
    console.error('[certificate-data]', err);
    return fail(c, 500, `Certificate data loading failed: ${err.message}`);
  }
});

// GET /api/parse-md-scopes?cert_type=  （旧 API 互換: { scopes: [...] }）
app.get('/parse-md-scopes', async c => {
  const certType = certTypeOf(c);
  if (!certType) return fail(c, 400, 'Invalid cert_type. Must be "a2la" or "jab"');
  try {
    const { doc, source } = await loadScopeDocument(c, certType);
    return ok(c, { scopes: toMatcherScopes(doc), source });
  } catch (err) {
    return fail(c, 500, `MD parsing failed: ${err.message}`);
  }
});

// POST /api/scope-matcher  { oj_standards: ["EN 55032:2015", ...] }
app.post('/scope-matcher', async c => {
  let body;
  try { body = await c.req.json(); } catch { return fail(c, 400, 'Invalid JSON body'); }
  const { oj_standards } = body || {};
  if (!Array.isArray(oj_standards)) return fail(c, 400, 'Missing or invalid oj_standards array');
  try {
    const [a2la, jab] = await Promise.all([loadScopes(c, 'a2la'), loadScopes(c, 'jab')]);
    const matches = oj_standards.map(standard => ({
      standard,
      scope_matches: { a2la: findScopeMatch(standard, a2la), jab: findScopeMatch(standard, jab) },
    }));
    return ok(c, {
      matches,
      total_standards: oj_standards.length,
      a2la_matches: matches.filter(m => m.scope_matches.a2la.status !== 'no_match').length,
      jab_matches: matches.filter(m => m.scope_matches.jab.status !== 'no_match').length,
    });
  } catch (err) {
    console.error('[scope-matcher]', err);
    return fail(c, 500, `Scope matching failed: ${err.message}`);
  }
});

// POST /api/scope-search  { search_query: "55032" }
app.post('/scope-search', async c => {
  let body;
  try { body = await c.req.json(); } catch { return fail(c, 400, 'Invalid JSON body'); }
  const { search_query } = body || {};
  if (!search_query || typeof search_query !== 'string') return fail(c, 400, 'Missing or invalid search_query');
  try {
    const [a2la, jab] = await Promise.all([loadScopes(c, 'a2la'), loadScopes(c, 'jab')]);
    const a2la_matches = searchInScopes(search_query, a2la);
    const jab_matches = searchInScopes(search_query, jab);
    return ok(c, { search_query, total_matches: a2la_matches.length + jab_matches.length, a2la_matches, jab_matches });
  } catch (err) {
    console.error('[scope-search]', err);
    return fail(c, 500, `Scope search failed: ${err.message}`);
  }
});

// GET /api/scopes/status  — D1 の投入状況（運用確認用）
app.get('/scopes/status', async c => ok(c, await scopeStatus(c)));

// GET /api/scope-oj-version-check
// 現行D1スコープ全件を、OJの有効掲載版数と一括突合する。
app.get('/scope-oj-version-check', async c => {
  try {
    const scopeDocuments = await Promise.all(CERT_TYPES.map(async certType => {
      const loaded = await loadScopeDocument(c, certType);
      return { certType, ...loaded };
    }));

    const standardsByDirective = {};
    const ojSources = {};
    for (const directive of DIRECTIVES) {
      try {
        const result = await getStandards(c, directive);
        standardsByDirective[directive] = result.standards;
        ojSources[directive] = {
          source: result.source,
          count: result.standards.length,
          last_modified: result.lastModified,
          last_checked: result.lastChecked,
        };
      } catch (err) {
        ojSources[directive] = { error: err.message };
      }
    }

    const result = buildScopeOjVersionCheck(scopeDocuments, standardsByDirective);
    const scopes = Object.fromEntries(scopeDocuments.map(({ certType, doc, source, certificate }) => [certType, {
      source,
      certificate_number: doc.info?.certificate_number || null,
      valid_until: doc.info?.valid_until || null,
      organization: doc.info?.organization || null,
      imported_at: certificate?.imported_at || null,
      item_count: doc.items.length,
    }]));
    return ok(c, { ...result, sources: { scopes, oj: ojSources } });
  } catch (err) {
    console.error('[scope-oj-version-check]', err);
    return fail(c, 500, `Scope/OJ version check failed: ${err.message}`);
  }
});

// GET /api/scope-detail?cert_type=jab&anchor=%23facility-2-telecom-port
// 「詳細を見る」用: 指定した試験区分（anchor）に属する全項目を、GitHub の MD に飛ばず画面内で返す。
app.get('/scope-detail', async c => {
  const certType = certTypeOf(c);
  if (!certType) return fail(c, 400, 'Invalid cert_type. Must be "a2la" or "jab"');
  const anchor = c.req.query('anchor');
  if (!anchor) return fail(c, 400, 'Missing anchor');
  try {
    const { doc, source } = await loadScopeDocument(c, certType);
    const matched = doc.items.filter(it => it.anchor === anchor);
    if (!matched.length) return fail(c, 404, `No scope items found for anchor "${anchor}"`);
    const facility = matched[0].facility_number
      ? doc.facilities.find(f => f.facility_number === matched[0].facility_number) || null
      : null;
    return ok(c, {
      cert_type: certType,
      category: matched[0].category || null,
      anchor,
      facility: facility ? { number: facility.facility_number, name: facility.name, location: facility.location || null } : null,
      items: matched.map(it => ({ standard: it.standard, description: it.description || '' })),
      certificate_info: doc.info,
      source, // 'd1' | 'md'
    });
  } catch (err) {
    console.error('[scope-detail]', err);
    return fail(c, 500, `Scope detail loading failed: ${err.message}`);
  }
});

// POST /api/certificate  { fileData: base64, fileName }  — 旧 API 互換（PDF ヘッダ検証のみ）
app.post('/certificate', async c => {
  let body;
  try { body = await c.req.json(); } catch { return fail(c, 400, 'Invalid JSON: request body must be JSON'); }
  if (!body || !body.fileData || !body.fileName) return fail(c, 400, 'Missing fileData or fileName');
  let bytes;
  try {
    const bin = atob(body.fileData);
    bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
  } catch (err) {
    return fail(c, 400, `Base64 decode failed: ${err.message}`);
  }
  const header = String.fromCharCode(...bytes.slice(0, 4));
  if (!header.startsWith('%PDF')) return fail(c, 400, 'File does not appear to be a valid PDF');
  const name = String(body.fileName).toLowerCase();
  const isA2LA = name.includes('a2la'), isJAB = name.includes('jab');
  const certMatch = body.fileName.match(/(\d{4}-\d{2})/);
  return ok(c, {
    certificate_info: {
      certificate_number: certMatch ? certMatch[1] : 'Unknown',
      organization: isA2LA ? 'A2LA Certificate Detected' : isJAB ? 'JAB Certificate Detected' : 'Certificate Type Unknown',
      valid_until: 'Parsing Disabled',
      accreditation_body: isA2LA ? 'A2LA' : isJAB ? 'JAB' : 'Unknown',
      revision_date: 'Unknown',
    },
    test_standards: [], categories: {}, total_standards: 0,
    extraction_date: new Date().toISOString(),
    pdf_source: body.fileName,
    certificate_type: 'Basic_Validation_Only',
    note: `PDF file validated successfully: ${body.fileName} (${bytes.length} bytes). Full text parsing is disabled to avoid server errors.`,
  });
});

export default app;
