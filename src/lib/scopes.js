// 認定スコープ（JAB / A2LA）の読み込み
//
//   D1（DB バインディング、シード済み） → 無ければ static/data/{type}-scopes.md を実行時にパース
//
// どちらから読んでも同じ構造（parseScopesDocument と同じ形）を返し、API 層で旧レスポンス形状に変換する。

import { parseScopesDocument, toMatcherScopes, toCertificateData } from './md.js';
import { readAssetText } from './http.js';

export const CERT_TYPES = ['a2la', 'jab'];

const memory = new Map();
const MEMORY_TTL_MS = 5 * 60 * 1000;

/**
 * @returns {Promise<{doc: object, source: 'd1'|'md', certificate: object|null}>}
 */
export async function loadScopeDocument(c, certType, { noCache = false } = {}) {
  if (!CERT_TYPES.includes(certType)) throw new Error(`Invalid cert_type: ${certType}`);
  const key = `scopes:${certType}`;
  const hit = memory.get(key);
  if (!noCache && hit && Date.now() - hit.at < MEMORY_TTL_MS) return hit.value;

  let value = null;
  if (c.env.DB) {
    try {
      value = await loadFromD1(c.env.DB, certType);
    } catch (err) {
      console.error(`[scopes] D1 read failed for ${certType}, falling back to MD: ${err.message}`);
    }
  }
  if (!value) {
    const md = await readAssetText(c, `/data/${certType}-scopes.md`);
    value = { doc: parseScopesDocument(md, certType), source: 'md', certificate: null };
  }
  memory.set(key, { at: Date.now(), value });
  return value;
}

async function loadFromD1(db, certType) {
  const cert = await db.prepare(
    `SELECT id, cert_type, certificate_number, organization, accreditation_body, valid_until, accreditation_standard, extra_info, source_file, source_hash, imported_at
       FROM certificates WHERE cert_type = ?1 AND is_current = 1 ORDER BY id DESC LIMIT 1`
  ).bind(certType).first();
  if (!cert) return null; // 未シード → MD フォールバック

  const [facRes, itemRes] = await Promise.all([
    db.prepare(`SELECT id, facility_number, name, location, anchor FROM facilities WHERE certificate_id = ?1 ORDER BY id`).bind(cert.id).all(),
    db.prepare(
      `SELECT s.standard, s.description, s.category, s.anchor, s.sort_order, f.facility_number
         FROM scope_items s LEFT JOIN facilities f ON f.id = s.facility_id
        WHERE s.certificate_id = ?1 ORDER BY s.sort_order`
    ).bind(cert.id).all(),
  ]);

  const info = {
    certificate_number: cert.certificate_number,
    organization: cert.organization,
    valid_until: cert.valid_until,
    accreditation_body: cert.accreditation_body,
  };
  if (cert.accreditation_standard) info.accreditation_standard = cert.accreditation_standard;
  try { Object.assign(info, JSON.parse(cert.extra_info || '{}')); } catch { /* ignore */ }

  const facilities = (facRes.results || []).map(f => ({ facility_number: f.facility_number, name: f.name, location: f.location, anchor: f.anchor }));
  const items = (itemRes.results || []).map(r => ({
    standard: r.standard, description: r.description || '', category: r.category, anchor: r.anchor,
    facility_number: r.facility_number || null, sort_order: r.sort_order,
  }));
  const categories = [...new Set(items.map(i => i.category).filter(Boolean))];
  return {
    doc: { info, facilities, items, categories },
    source: 'd1',
    certificate: { id: cert.id, source_file: cert.source_file, source_hash: cert.source_hash, imported_at: cert.imported_at },
  };
}

/** 照合・検索用のフラットな配列 */
export async function loadScopes(c, certType) {
  const { doc } = await loadScopeDocument(c, certType);
  return toMatcherScopes(doc);
}

/** certificate-data API 用（旧 parseCertificateMD 互換 + 出典情報） */
export async function loadCertificateData(c, certType) {
  const { doc, source, certificate } = await loadScopeDocument(c, certType);
  const data = toCertificateData(doc, certType);
  data.source = source;
  if (certificate) data.imported_at = certificate.imported_at;
  return data;
}

/** 運用確認用: D1 の状態（シード済みか、どの改訂が current か） */
export async function scopeStatus(c) {
  const out = { d1_bound: !!c.env.DB, certificates: [] };
  if (!c.env.DB) return out;
  try {
    const res = await c.env.DB.prepare(
      `SELECT c.cert_type, c.certificate_number, c.valid_until, c.is_current, c.imported_at, substr(c.source_hash, 1, 12) AS hash,
              (SELECT COUNT(*) FROM scope_items s WHERE s.certificate_id = c.id) AS item_count,
              (SELECT COUNT(*) FROM facilities f WHERE f.certificate_id = c.id) AS facility_count
         FROM certificates c ORDER BY c.cert_type, c.id DESC`
    ).all();
    out.certificates = res.results || [];
  } catch (err) {
    out.error = err.message;
  }
  return out;
}

export function clearScopeCache() {
  memory.clear();
}
