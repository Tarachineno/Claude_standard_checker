// OJ 整合規格リスト（EMC / RED / LVD）の取得
//
//   取得順:  KV キャッシュ → EC 公式サイトから Excel を取得（更新があれば差分を記録）
//            → 失敗時はリポジトリ同梱の static/data/{directive}.xlsx → 最後に fallback-standards.json
//
// 旧 Netlify 版は Lambda のローカルディスクに Excel を書き込んでいた。Workers にはディスクが無いので
// KV（CACHE バインディング）に置き換えた。KV が未設定でも同梱 Excel で動く。

import { parseStandardsFromXlsx } from './excel.js';
import { readAssetJson, readAssetBytes } from './http.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const XLSX_ACCEPT = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*';
export const DIRECTIVES = ['RED', 'EMC', 'LVD'];

// isolate 内の短期メモリキャッシュ（同じ isolate に来た連続リクエストで Excel を毎回パースしない）
const memory = new Map();
const MEMORY_TTL_MS = 60 * 1000;

export async function loadDirectives(c) {
  const json = await readAssetJson(c, '/api/directives.json');
  return json.data || [];
}

export async function getDirectiveConfig(c, code) {
  const list = await loadDirectives(c);
  return list.find(d => d.code === code) || null;
}

/**
 * 指定指令の整合規格リストを返す。
 * @returns {Promise<{standards:Array, updateAvailable:boolean, added:string[], excelFilename:string, source:string, lastModified?:string, lastChecked?:string}>}
 */
export async function getStandards(c, directive, { forceRefresh = false } = {}) {
  const config = await getDirectiveConfig(c, directive);
  if (!config) throw new Error(`Unknown directive: ${directive}`);

  const memKey = `standards:${directive}`;
  const cached = memory.get(memKey);
  if (!forceRefresh && cached && Date.now() - cached.at < MEMORY_TTL_MS) return cached.value;

  const value = await loadWithCache(c, directive, config, forceRefresh);
  memory.set(memKey, { at: Date.now(), value });
  return value;
}

async function loadWithCache(c, directive, config, forceRefresh) {
  const kv = c.env.CACHE || null;
  const recheckSec = Number(c.env.STANDARDS_RECHECK_SECONDS || 21600);
  const now = Date.now();

  let meta = kv ? await kv.get(`meta:${directive}`, 'json') : null;
  const kvBytes = async () => (kv ? await kv.get(`xlsx:${directive}`, 'arrayBuffer') : null);

  // 1) キャッシュが新しければそのまま使う
  if (!forceRefresh && kv && meta && meta.checkedAt && now - Date.parse(meta.checkedAt) < recheckSec * 1000) {
    const buf = await kvBytes();
    if (buf) return finish(parseStandardsFromXlsx(new Uint8Array(buf), directive), { meta, source: 'kv', updateAvailable: false, added: [] });
  }

  // 2) EC 公式サイトへ（更新確認 → 必要なら再取得）
  try {
    const excelUrl = await resolveExcelUrl(config);
    let remoteLastMod = null;
    try {
      const head = await fetch(excelUrl, { method: 'HEAD', redirect: 'follow', headers: { 'User-Agent': UA } });
      if (head.ok) remoteLastMod = head.headers.get('last-modified');
    } catch { /* HEAD 非対応でも続行 */ }

    if (kv && meta && remoteLastMod && meta.lastModified === remoteLastMod) {
      const buf = await kvBytes();
      if (buf) {
        meta = { ...meta, checkedAt: new Date(now).toISOString() };
        await kv.put(`meta:${directive}`, JSON.stringify(meta));
        return finish(parseStandardsFromXlsx(new Uint8Array(buf), directive), { meta, source: 'kv', updateAvailable: false, added: [] });
      }
    }

    const { bytes, filename } = await downloadExcel(excelUrl, directive);
    const standards = parseStandardsFromXlsx(bytes, directive);
    if (!standards.length) throw new Error('Excel parsed but no standards found');

    // 差分（前回キャッシュとの比較）
    let added = [];
    let updateAvailable = false;
    const prev = await kvBytes();
    if (prev) {
      const oldNumbers = new Set(parseStandardsFromXlsx(new Uint8Array(prev), directive).map(s => s.number));
      added = standards.map(s => s.number).filter(n => !oldNumbers.has(n));
      updateAvailable = added.length > 0 || (remoteLastMod && meta?.lastModified && meta.lastModified !== remoteLastMod);
    }

    const newMeta = {
      lastModified: remoteLastMod || new Date(now).toISOString(),
      filename,
      checkedAt: new Date(now).toISOString(),
      updatedAt: updateAvailable || !meta ? new Date(now).toISOString() : (meta.updatedAt || new Date(now).toISOString()),
      lastAdded: updateAvailable ? added : (meta?.lastAdded || []),
      count: standards.length,
    };
    if (kv) {
      await kv.put(`xlsx:${directive}`, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      await kv.put(`meta:${directive}`, JSON.stringify(newMeta));
    }
    return finish(standards, { meta: newMeta, source: 'ec', updateAvailable, added });
  } catch (err) {
    console.error(`[standards] EC fetch failed for ${directive}: ${err.message}`);
  }

  // 3) KV に古いキャッシュがあればそれを使う
  const stale = await kvBytes();
  if (stale) return finish(parseStandardsFromXlsx(new Uint8Array(stale), directive), { meta, source: 'kv-stale', updateAvailable: false, added: [] });

  // 4) リポジトリ同梱の Excel
  try {
    const bytes = await readAssetBytes(c, `/data/${directive}.xlsx`);
    let bundledMeta = null;
    try { bundledMeta = await readAssetJson(c, `/data/${directive}-meta.json`); } catch { /* optional */ }
    return finish(parseStandardsFromXlsx(bytes, directive), { meta: bundledMeta, source: 'bundled', updateAvailable: false, added: [] });
  } catch (err) {
    console.error(`[standards] bundled xlsx failed for ${directive}: ${err.message}`);
  }

  // 5) 最終フォールバック
  const fallback = await readAssetJson(c, '/data/fallback-standards.json');
  const fb = fallback[directive] || { standards: [] };
  return finish(fb.standards || [], { meta: null, source: 'fallback', updateAvailable: false, added: [] });
}

function finish(standards, { meta, source, updateAvailable, added }) {
  return {
    standards,
    updateAvailable: !!updateAvailable,
    added,
    excelFilename: meta?.filename || null,
    source,
    lastModified: meta?.lastModified || null,
    lastChecked: meta?.checkedAt || null,
    lastUpdated: meta?.updatedAt || null,
    lastAdded: meta?.lastAdded || [],
  };
}

// ---------------------------------------------------------------------------
// EC サイトから Excel の URL を求める
// ---------------------------------------------------------------------------

function isPageUrl(url) {
  const u = url.split('#')[0];
  return (u.includes('/harmonised-standards/') || u.includes('/docsroom/documents/'))
    && !u.includes('.xlsx') && !u.includes('.xls') && !u.includes('document/download') && !u.includes('/attachments/');
}

export async function resolveExcelUrl(config) {
  const excelUrl = String(config.excel_url || '');
  if (!excelUrl) throw new Error(`No excel_url configured for ${config.code}`);
  if (!isPageUrl(excelUrl)) return excelUrl;

  const pageUrl = excelUrl.split('#')[0];
  let found = await extractExcelLinkFromECPage(pageUrl);
  if (!found && config.ec_webpage && config.ec_webpage !== excelUrl) {
    found = await extractExcelLinkFromECPage(config.ec_webpage);
  }
  if (!found) throw new Error(`Excel link not found on EC page: ${pageUrl}`);
  return found;
}

const LINK_PATTERNS = ['summary list as xls file', 'summary list as xls', 'summary list as excel file', 'summary list as excel', 'xls file', 'excel file', 'summary list'];

/** HTML 文字列から <a> の href とテキストを列挙（cheerio の置き換え。EC のページはサーバー描画なので正規表現で足りる） */
export function listAnchors(html) {
  const out = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const hrefMatch = m[1].match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const href = hrefMatch ? (hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3]) : '';
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (href) out.push({ href: decodeEntities(href), text });
  }
  return out;
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

/** EC ページの HTML から Excel リンクを探す（純粋関数・テスト可能） */
export function findExcelLinkInHtml(html, baseUrl) {
  const anchors = listAnchors(html);
  const looksLikeExcel = (href, pattern) =>
    href.includes('.xlsx') || href.includes('.xls') || href.includes('document/download') || href.includes('/attachments/')
    || href.includes('/renditions/native') || (href.includes('docsroom/documents/') && /xls|excel/.test(pattern));

  let found = null;
  for (const pattern of LINK_PATTERNS) {
    found = anchors.find(a => a.text.toLowerCase().includes(pattern) && looksLikeExcel(a.href, pattern));
    if (found) break;
  }
  if (!found) return null;
  try {
    return new URL(found.href, baseUrl).href;
  } catch {
    return null;
  }
}

export async function extractExcelLinkFromECPage(ecUrl) {
  try {
    const isDocsroomApi = ecUrl.includes('docsroom/documents/') && !ecUrl.includes('/attachments/') && !ecUrl.includes('/renditions/');
    const res = await fetch(ecUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept': isDocsroomApi ? 'application/json,*/*' : 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.5' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const finalUrl = res.url || ecUrl;

    if (isDocsroomApi || finalUrl.includes('docsroom/documents/')) {
      try {
        const json = JSON.parse(text);
        const link = json?.attachments?.[0]?.links?.find(l => l.rel === 'native');
        if (link?.href) return link.href;
      } catch { /* HTML として続行 */ }
    }
    return findExcelLinkInHtml(text, ecUrl);
  } catch (err) {
    console.error(`[standards] extractExcelLinkFromECPage(${ecUrl}): ${err.message}`);
    return null;
  }
}

function filenameFromResponse(res, fallbackUrl, directive) {
  const cd = res.headers.get('content-disposition');
  if (cd) {
    const m = cd.match(/filename\*?=(?:UTF-8'')?((['"]).*?\2|[^;\n]*)/i);
    if (m && m[1]) {
      let f = m[1].replace(/['"]/g, '');
      try { f = decodeURIComponent(f); } catch { /* keep */ }
      if (f) return f;
    }
  }
  try {
    const u = new URL(res.url || fallbackUrl);
    const q = u.searchParams.get('filename');
    if (q) { try { return decodeURIComponent(q); } catch { return q; } }
    const last = u.pathname.split('/').pop();
    if (last && last.includes('.')) return last;
  } catch { /* ignore */ }
  return `${directive}.xlsx`;
}

/** Excel をダウンロード。docsroom の HTML ページへリダイレクトされた場合は添付 URL を組み立てて再取得 */
export async function downloadExcel(excelUrl, directive) {
  let res = await fetch(excelUrl, { redirect: 'follow', headers: { 'User-Agent': UA, 'Accept': XLSX_ACCEPT, 'Accept-Language': 'en-US,en;q=0.5' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${excelUrl}`);

  const finalUrl = res.url || excelUrl;
  const ct = res.headers.get('content-type') || '';
  if (finalUrl.includes('docsroom/documents/') && (ct.includes('text/html') || !ct.includes('openxmlformats'))) {
    const idMatch = finalUrl.match(/docsroom\/documents\/(\d+)/);
    let dl = null;
    if (idMatch) {
      const b = new URL(finalUrl);
      dl = `${b.protocol}//${b.host}/docsroom/documents/${idMatch[1]}/attachments/1/translations/en/renditions/native`;
    } else {
      const html = await res.text();
      const a = listAnchors(html).find(x => x.href.includes('/renditions/native'));
      if (a) dl = new URL(a.href, finalUrl).href;
    }
    if (!dl) throw new Error('Could not construct docsroom Excel download URL');
    res = await fetch(dl, { redirect: 'follow', headers: { 'User-Agent': UA, 'Accept': XLSX_ACCEPT } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${dl}`);
  }

  const filename = filenameFromResponse(res, excelUrl, directive);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength < 1000) throw new Error(`Downloaded file too small (${bytes.byteLength} bytes)`);
  return { bytes, filename };
}
