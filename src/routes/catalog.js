import { Hono } from 'hono';
import { ok, fail } from '../lib/http.js';
import { CERT_TYPES, loadScopeDocument } from '../lib/scopes.js';
import { inventoryOf, loadCatalog, withSearchLinks, validateManual, saveManual } from '../lib/catalog.js';
import { recentPublisherChanges } from '../lib/publisher-review.js';
import { isWithdrawnRecord } from '../lib/publisher-lifecycle.js';
import { CATALOG_ORIGIN, catalogAuthMode, accessConfiguration, accessIdentity, adminAudit } from '../lib/catalog-auth.js';

const app = new Hono();
app.get('/catalog/changes', async c => {
  c.header('Cache-Control', 'no-store');
  if (!c.env.DB) return fail(c, 503, 'Catalogue database is not configured');
  try { return ok(c, await recentPublisherChanges(c.env.DB)); }
  catch { return fail(c, 503, 'Publisher change history unavailable. Check database migrations.'); }
});
async function authorize(c) {
  if (!c.env.CATALOG_ADMIN_TOKEN) return false;
  const supplied = c.req.header('Authorization') || '';
  // Compare equal-length hashes instead of short-circuit string comparisons.
  const digest = s => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  const [a, b] = await Promise.all([digest(supplied), digest('Bearer ' + c.env.CATALOG_ADMIN_TOKEN)]);
  return new Uint8Array(a).reduce((diff, byte, i) => diff | (byte ^ new Uint8Array(b)[i]), 0) === 0;
}
async function requireAdmin(c, next) {
  const mode = catalogAuthMode(c.env);
  if (mode === 'access') {
    try { accessConfiguration(c.env); } catch { return fail(c, 503, 'Catalogue email authentication is not configured'); }
    if (new URL(c.req.url).origin !== CATALOG_ORIGIN || c.req.header('Origin') !== CATALOG_ORIGIN
      || (c.req.header('Sec-Fetch-Site') && c.req.header('Sec-Fetch-Site') !== 'same-origin')
      || !/^application\/json(?:\s*;|$)/i.test(c.req.header('Content-Type') || '')) return fail(c, 403, 'Same-origin JSON request required');
    const actor = await accessIdentity(c);
    if (!actor) return fail(c, 401, 'Sign in with your @sgs.com email');
    c.set('catalogActor', actor);
    return next();
  }
  if (mode !== 'token') return fail(c, 503, 'Unknown catalogue authentication mode');
  if (!await authorize(c)) return fail(c, 401, 'Catalogue administration key required');
  return next();
}

app.get('/catalog/auth', async c => {
  c.header('Cache-Control', 'no-store');
  c.header('Vary', 'Cookie, Cf-Access-Jwt-Assertion');
  const mode = catalogAuthMode(c.env);
  if (mode === 'token') return c.json({success:true,data:{mode, user:null}});
  if (mode !== 'access') return c.json({success:false,error:'Unknown catalogue authentication mode'},503);
  try {
    const user = await accessIdentity(c);
    return c.json({success:true,data:{mode,user,login_url:CATALOG_ORIGIN+'/api/catalog/login',logout_url:CATALOG_ORIGIN+'/cdn-cgi/access/logout'}});
  } catch { return c.json({success:false,error:'Catalogue email authentication is not configured'},503); }
});
app.get('/catalog/login', async c => {
  c.header('Cache-Control','no-store');
  if (catalogAuthMode(c.env) !== 'access') return c.text('Email login is not enabled.',503);
  try {
    if (!await accessIdentity(c)) return c.text('Email sign-in required. Check the Cloudflare Access policy for this login path.',401);
    return c.redirect(CATALOG_ORIGIN+'/?catalog-login=1');
  } catch { return c.text('Email login is not configured.',503); }
});
async function bodyOf(c) {
  const text = await c.req.text();
  if (text.length > 16000) throw new Error('Request too large');
  const body = JSON.parse(text);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('A JSON object is required');
  return body;
}

app.get('/catalog', async c => {
  const docs = await Promise.all(CERT_TYPES.map(async certType => ({ certType, ...await loadScopeDocument(c, certType) })));
  const catalog = await loadCatalog(c);
  return ok(c, { available: catalog.available, error: catalog.error, admin_configured: catalogAuthMode(c.env) === 'access' ? !!c.env.CATALOG_ACCESS_AUD : !!c.env.CATALOG_ADMIN_TOKEN,
    items: withSearchLinks(inventoryOf(docs), catalog.records) });
});

app.post('/catalog/manual', requireAdmin, async c => {
  let record;
  try { record = validateManual(await bodyOf(c)); } catch (err) { return fail(c, 400, err.message); }
  if (!c.env.DB) return fail(c, 503, 'Catalogue database is not configured');
  try { await saveManual(c.env.DB, record, c.get('catalogActor')); }
  catch (error) {
    if (error.message.includes('lifecycle review workflow')) return fail(c, 409, 'Use the lifecycle review workflow to change a withdrawn reference');
    throw error;
  }
  return ok(c, record);
});

// Old pages and direct callers must not start the retired single-shot writer.
app.post('/catalog/refresh', c => fail(c, 410, 'Single-shot refresh is retired. Use the scheduled publisher review workflow.'));

app.post('/catalog/clear-manual', requireAdmin, async c => {
  let body;
  try { body = await bodyOf(c); } catch (err) { return fail(c, 400, err.message); }
  if (typeof body.key !== 'string' || body.key.length > 150) return fail(c, 400, 'Invalid reference key');
  if (!c.env.DB) return fail(c, 503, 'Catalogue database is not configured');
  const old = await c.env.DB.prepare('SELECT manual_json FROM publisher_catalog WHERE reference_key=?1').bind(body.key).first();
  if (!old?.manual_json) return fail(c, 404, 'No manual override');
  if (isWithdrawnRecord(JSON.parse(old.manual_json))) return fail(c, 409, 'Use the lifecycle review workflow to change a withdrawn reference');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE publisher_catalog SET manual_json=NULL WHERE reference_key=?1').bind(body.key),
    c.env.DB.prepare("INSERT INTO publisher_catalog_history(reference_key,origin,payload_json,recorded_at) VALUES (?1,'clear_manual',?2,?3)").bind(body.key, old.manual_json, new Date().toISOString()),
    ...adminAudit(c.env.DB, c.get('catalogActor'), body.key, 'clear_manual', new Date().toISOString()),
  ]);
  return ok(c, { key: body.key });
});

app.get('/catalog/history', async c => {
  if (!c.env.DB) return fail(c, 503, 'Catalogue database is not configured');
  const { results } = await c.env.DB.prepare('SELECT origin,payload_json,recorded_at FROM publisher_catalog_history WHERE reference_key=?1 ORDER BY id DESC LIMIT 20').bind(c.req.query('key') || '').all();
  return ok(c, results.map(r => ({ ...r, payload_json: JSON.parse(r.payload_json) })));
});
export default app;
