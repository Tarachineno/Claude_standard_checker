import { createRemoteJWKSet, jwtVerify } from 'jose';

export const CATALOG_ORIGIN = 'https://lab-scope-checker.seidaku.com';
const keySets = new Map();
export const catalogAuthMode = env => env.CATALOG_AUTH_MODE || 'token';
export function accessConfiguration(env) {
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.CATALOG_ACCESS_TEAM_DOMAIN || '')
    || !/^[a-f0-9]{64}$/i.test(env.CATALOG_ACCESS_AUD || '')) throw new Error('Catalogue email authentication is not configured');
  return { issuer: env.CATALOG_ACCESS_TEAM_DOMAIN, audience: env.CATALOG_ACCESS_AUD };
}

// Never trust an email header alone. Verify issuer, signature, audience and expiry.
export async function verifyCatalogIdentity(token, config, keySet) {
  if (typeof token !== 'string' || token.length > 16384) throw new Error('Invalid identity');
  const { payload } = await jwtVerify(token, keySet, { ...config, algorithms: ['RS256'],
    requiredClaims: ['sub','email','exp','iat'], clockTolerance: 5 });
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@sgs\.com$/.test(email) || email.length > 254
    || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255
    || payload.iat > Date.now() / 1000 + 5 || payload.type !== 'app') throw new Error('Invalid identity');
  return { id: payload.sub, email, method: 'access' };
}

export async function accessIdentity(c) {
  const config = accessConfiguration(c.env);
  // The workers.dev and legacy aliases must not become alternate write entrances.
  if (new URL(c.req.url).origin !== CATALOG_ORIGIN) return null;
  const token = c.req.header('Cf-Access-Jwt-Assertion')
    || (c.req.header('Cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith('CF_Authorization='))?.slice('CF_Authorization='.length);
  if (!token) return null;
  if (!keySets.has(config.issuer)) keySets.set(config.issuer, createRemoteJWKSet(new URL(config.issuer + '/cdn-cgi/access/certs'), { timeoutDuration: 5000 }));
  try { return await verifyCatalogIdentity(token, config, keySets.get(config.issuer)); }
  catch { return null; }
}

export function adminAudit(db, actor, key, action, recordedAt) {
  if (!actor) return [];
  return [db.prepare('INSERT INTO publisher_admin_audit(reference_key,action,actor_id,actor_email,recorded_at) VALUES (?1,?2,?3,?4,?5)')
    .bind(key, action, actor.id, actor.email, recordedAt)];
}
