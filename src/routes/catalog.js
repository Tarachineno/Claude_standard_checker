import { Hono } from 'hono';
import { ok, fail } from '../lib/http.js';
import { CERT_TYPES, loadScopeDocument } from '../lib/scopes.js';
import { inventoryOf, loadCatalog, withSearchLinks, validateManual, saveManual, syncCatalog } from '../lib/catalog.js';

const app = new Hono();
async function authorize(c) {
  if (!c.env.CATALOG_ADMIN_TOKEN) return false;
  const supplied = c.req.header('Authorization') || '';
  // Compare equal-length hashes instead of short-circuit string comparisons.
  const digest = s => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  const [a, b] = await Promise.all([digest(supplied), digest('Bearer ' + c.env.CATALOG_ADMIN_TOKEN)]);
  return new Uint8Array(a).reduce((diff, byte, i) => diff | (byte ^ new Uint8Array(b)[i]), 0) === 0;
}
async function requireAdmin(c, next) {
  if (!await authorize(c)) return fail(c, 401, 'Catalogue administration key required');
  return next();
}
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
  return ok(c, { available: catalog.available, error: catalog.error, admin_configured: !!c.env.CATALOG_ADMIN_TOKEN,
    items: withSearchLinks(inventoryOf(docs), catalog.records) });
});

app.post('/catalog/manual', requireAdmin, async c => {
  let record;
  try { record = validateManual(await bodyOf(c)); } catch (err) { return fail(c, 400, err.message); }
  if (!c.env.DB) return fail(c, 503, 'Catalogue database is not configured');
  await saveManual(c.env.DB, record);
  return ok(c, record);
});

app.post('/catalog/refresh', requireAdmin, async c => {
  let body;
  try { body = await bodyOf(c); } catch (err) { return fail(c, 400, err.message); }
  if (body.keys && (!Array.isArray(body.keys) || body.keys.length > 10 || body.keys.some(k => typeof k !== 'string' || k.length > 150))) return fail(c, 400, 'Provide up to 10 reference keys');
  if (body.force && !body.keys?.length) return fail(c, 400, 'Force refresh requires explicit keys');
  try { return ok(c, await syncCatalog(c, { keys: body.keys, force: !!body.force, limit: 3 })); }
  catch (err) { return fail(c, 503, err.message); }
});

app.post('/catalog/clear-manual', requireAdmin, async c => {
  let body;
  try { body = await bodyOf(c); } catch (err) { return fail(c, 400, err.message); }
  if (typeof body.key !== 'string' || body.key.length > 150) return fail(c, 400, 'Invalid reference key');
  if (!c.env.DB) return fail(c, 503, 'Catalogue database is not configured');
  const old = await c.env.DB.prepare('SELECT manual_json FROM publisher_catalog WHERE reference_key=?1').bind(body.key).first();
  if (!old?.manual_json) return fail(c, 404, 'No manual override');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE publisher_catalog SET manual_json=NULL WHERE reference_key=?1').bind(body.key),
    c.env.DB.prepare("INSERT INTO publisher_catalog_history(reference_key,origin,payload_json,recorded_at) VALUES (?1,'clear_manual',?2,?3)").bind(body.key, old.manual_json, new Date().toISOString()),
  ]);
  return ok(c, { key: body.key });
});

app.get('/catalog/history', async c => {
  if (!c.env.DB) return fail(c, 503, 'Catalogue database is not configured');
  const { results } = await c.env.DB.prepare('SELECT origin,payload_json,recorded_at FROM publisher_catalog_history WHERE reference_key=?1 ORDER BY id DESC LIMIT 20').bind(c.req.query('key') || '').all();
  return ok(c, results.map(r => ({ ...r, payload_json: JSON.parse(r.payload_json) })));
});
export default app;
