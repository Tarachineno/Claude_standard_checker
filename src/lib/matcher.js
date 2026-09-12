// 規格番号の正規化・照合ロジック（旧 scope-matcher.js / scope-search.js から純粋関数として抽出）
// 判定結果の status 文字列と note の文言は旧 API と完全互換（フロントの translateScopeNote が依存）。

const PREFIX_RE = /^(EN|ETSI|IEC|ISO|CISPR|JIS|KS)\s*/i;

/** "EN 55032:2015" → "55032", "EN 301 489-1" → "301-489-1" */
export function extractStandardCore(standard) {
  if (!standard) return '';
  const cleaned = String(standard)
    .replace(PREFIX_RE, '')
    .replace(PREFIX_RE, '')
    .replace(/^(C|T)\s+/i, '')
    .trim();
  const m = cleaned.match(/^(\d+(?:[-\s]\d+)*)/);
  return m ? m[1].replace(/\s+/g, '-') : '';
}

/** ":2015" / "(2004)" / "V1.2.3" を抜き出す */
export function extractVersion(standard) {
  if (!standard) return '';
  const m = String(standard).match(/:(\d{4})|(\(\d{4}\))|(V\d+\.\d+\.\d+)/);
  return m ? (m[1] || m[2] || m[3]) : '';
}

/** 年版・バージョン表記を区切り記号ごと取り除く（"EN 55032:2015" → "EN 55032"） */
export function stripVersion(standard) {
  return String(standard || '').replace(/\s*:\d{4}\b|\s*\(\d{4}\)|\s*V\d+\.\d+\.\d+/g, '').trim();
}

/** 規格番号の「番号より前の部分」（"ETSI EN 300 328 V2.2.2" → "ETSI EN"） */
export function extractPrefix(standard) {
  const m = stripVersion(standard).match(/^([^0-9]*)/);
  return m ? m[1].replace(/[\s:]+$/, '').trim() : '';
}

/** "EN 301 489-52 V1.2.1" → "489-52" */
export function extractPartNumber(standard) {
  if (!standard) return '';
  const cleaned = String(standard)
    .replace(PREFIX_RE, '')
    .replace(/:?\d{4}.*$/, '')
    .replace(/\sV\d+\.\d+.*$/, '')
    .trim();
  const m = cleaned.match(/(?:\d+\s+)?(\d+(?:-\d+)*)/);
  return m ? m[1] : '';
}

/** 包括表記（"EN 301 489-1 / -3 / -7 / -52"）に部番が含まれるか */
export function isComprehensiveScopeMatch(ojPartNumber, scopeStandard) {
  if (!ojPartNumber || !scopeStandard) return false;
  const m = scopeStandard.match(/(\d+(?:\s+\d+)*)-(\d+)(?:\s*\/\s*-\d+)+/);
  if (!m) return false;
  const scopeBase = m[1];
  const scopeParts = scopeStandard.match(/\s*\/\s*-(\d+)|-(\d+)/g);
  if (!scopeParts) return false;

  const ojBase = ojPartNumber.includes('-') ? ojPartNumber.substring(0, ojPartNumber.lastIndexOf('-')) : ojPartNumber;
  if (!scopeBase.includes(ojBase) && !ojBase.includes(scopeBase)) return false;

  const included = scopeParts.map(p => { const n = p.match(/-(\d+)/); return n ? n[1] : null; }).filter(Boolean);
  const ojPart = ojPartNumber.includes('-') ? ojPartNumber.split('-').pop() : ojPartNumber;
  return included.includes(ojPart);
}

/** 比較用の正規化（大小文字・連続空白を無視） */
const norm = s => String(s || '').replace(/\s+/g, ' ').trim().toUpperCase();

const NO_MATCH = { status: 'no_match', matched_standard: null, note: null, anchor: null };

// 複数のスコープ項目に当たった場合の優先順位（小さいほど良い）。
// 旧実装は「最初に core が一致した項目」を返していたため、A2LA のように
// "IEC 61000-4-2" が "EN 61000-4-2" より前に並ぶと、EN 規格の照会が「表記違い(EN/IEC)」になっていた。
const STATUS_RANK = {
  exact_match: 0,
  version_tolerant_match: 1,
  comprehensive_match: 2,
  prefix_mismatch: 3,
  version_mismatch: 4,
  no_match: 9,
};

/** 1 つのスコープ項目に対する照合（旧 findScopeMatch のループ本体） */
function matchOne(ojStandard, ojCore, ojVersion, ojPart, scope) {
  const scopeCore = extractStandardCore(scope.standard);
  const scopeVersion = extractVersion(scope.standard);
  const base = { matched_standard: scope.standard, anchor: scope.anchor, facility: scope.facility || null };

  if (ojCore === scopeCore) {
    if (norm(ojStandard) === norm(scope.standard)) return { status: 'exact_match', note: null, ...base };

    if (ojVersion && scopeVersion && ojVersion !== scopeVersion) {
      return { status: 'version_mismatch', note: `年版違い(${ojVersion}↔${scopeVersion})`, ...base };
    }

    // 旧実装は年版の数字だけを消していたため "EN 55032:2015" の ":" が残り、
    // "EN 55032" との比較が「表記違い(EN :/EN)」になっていた。区切り記号ごと消して比較する。
    const ojPrefix = extractPrefix(ojStandard);
    const scopePrefix = extractPrefix(scope.standard);

    if ((ojVersion && !scopeVersion) || (!ojVersion && scopeVersion)) {
      if (ojPrefix.toUpperCase() === scopePrefix.toUpperCase()) {
        return { status: 'version_tolerant_match', note: ojVersion ? `バージョン包括(${ojVersion})` : 'スコープに適用', ...base };
      }
    }
    if (ojPrefix.toUpperCase() !== scopePrefix.toUpperCase()) {
      return { status: 'prefix_mismatch', note: `表記違い(${ojPrefix || '?'}/${scopePrefix || '?'})`, ...base };
    }
    // 同じ core・同じ prefix・両方バージョン無し（大小文字違いなど）→ 事実上の一致
    return { status: 'exact_match', note: null, ...base };
  }

  if (ojPart && isComprehensiveScopeMatch(ojPart, scope.standard)) {
    return { status: 'comprehensive_match', note: `包括スコープ適用(${ojPart}含む)`, ...base };
  }
  return null;
}

/**
 * OJ 側の 1 規格を認定スコープ配列と照合し、最も良い一致を返す。
 * @param {string} ojStandard
 * @param {Array<{standard:string, anchor:string, facility?:string}>} scopes
 */
export function findScopeMatch(ojStandard, scopes) {
  const ojCore = extractStandardCore(ojStandard);
  const ojVersion = extractVersion(ojStandard);
  if (!ojCore) return { ...NO_MATCH };
  const ojPart = extractPartNumber(ojStandard);

  let best = null;
  for (const scope of scopes) {
    const r = matchOne(ojStandard, ojCore, ojVersion, ojPart, scope);
    if (!r) continue;
    if (!best || STATUS_RANK[r.status] < STATUS_RANK[best.status]) best = r;
    if (best.status === 'exact_match') break;
  }
  return best || { ...NO_MATCH };
}

/** 同じ規格に当たる候補をすべて返す（クイック判定の「他の施設でも可」表示用） */
export function findAllScopeMatches(ojStandard, scopes) {
  const ojCore = extractStandardCore(ojStandard);
  const ojVersion = extractVersion(ojStandard);
  if (!ojCore) return [];
  const ojPart = extractPartNumber(ojStandard);
  const out = [];
  for (const scope of scopes) {
    const r = matchOne(ojStandard, ojCore, ojVersion, ojPart, scope);
    if (r) out.push(r);
  }
  return out.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);
}

/** 照合結果の status → 営業向けの 3 段階（ok / check / ng） */
export function verdictOf(status) {
  switch (status) {
    case 'exact_match':
    case 'comprehensive_match':
    case 'version_tolerant_match':
    case 'prefix_mismatch':
      return 'ok';
    case 'version_mismatch':
      return 'check';
    default:
      return 'ng';
  }
}

// ---------------------------------------------------------------------------
// scope-search（部分一致・範囲表記を含む緩い検索）
// ---------------------------------------------------------------------------

export function searchInScopes(searchQuery, scopes) {
  const q = String(searchQuery).toLowerCase().trim();
  const matches = [];
  for (const scope of scopes) {
    const r = findSearchMatch(q, scope);
    if (r) {
      matches.push({
        standard: scope.standard,
        description: scope.description || '',
        facility: scope.facility || null,
        anchor: scope.anchor,
        match_type: r.type,
        note: r.note || null,
      });
    }
  }
  return matches;
}

function findSearchMatch(q, scope) {
  const s = scope.standard.toLowerCase();
  if (s.includes(q)) return { type: 'partial' };
  if (s.replace(/\s+/g, '').includes(q.replace(/\s+/g, ''))) return { type: 'partial' };
  if (checkRangeNotationMatch(q, s)) return { type: 'range_match', note: '範囲適用' };
  // 包括表記（"EN 301 489-1 / -3 / … / -52"）に部番が含まれる場合も検索でヒットさせる
  const qPart = extractPartNumber(q);
  if (qPart && qPart.includes('-') && isComprehensiveScopeMatch(qPart, scope.standard)) {
    return { type: 'range_match', note: '範囲適用' };
  }

  const qCore = extractStandardCore(q);
  const sCore = extractStandardCore(scope.standard);
  if (!qCore || !sCore) return null;
  if (qCore !== sCore) return null;

  if (q === s) return { type: 'exact' };
  const qv = extractVersion(q);
  const sv = extractVersion(scope.standard);
  if (qv && sv && qv !== sv) return { type: 'version_mismatch', note: `年版違い(${qv}↔${sv})` };
  const qPrefix = extractPrefix(q);
  const sPrefix = extractPrefix(scope.standard);
  if (qPrefix.toLowerCase() !== sPrefix.toLowerCase()) {
    return { type: 'prefix_mismatch', note: `表記違い(${qPrefix || '?'}/${sPrefix || '?'})` };
  }
  return { type: 'partial' };
}

function checkRangeNotationMatch(q, scopeStandard) {
  // "065-1/-2/-3" と "065-1 / -2 / -3"（空白あり）の両方を範囲表記として扱う
  const ranges = scopeStandard.match(/(\d+(?:-\d+)*)((?:\s*\/\s*-\d+)+)/g);
  if (!ranges) return false;
  const nq = q.replace(/\s+/g, '').toLowerCase();
  const prefixMatch = scopeStandard.match(/^([^0-9]*)/);
  const prefix = prefixMatch ? prefixMatch[1].trim() : '';
  for (const range of ranges) {
    const [basePart, ...rest] = range.split(/\s*\/\s*/);
    const baseCore = basePart.replace(/-\d+$/, '');
    const all = [basePart, ...rest.map(p => baseCore + p)];
    for (const part of all) {
      const np = part.replace(/\s+/g, '').toLowerCase();
      if (np.includes(nq) || nq.includes(np)) return true;
      if (prefix) {
        const full = (prefix + ' ' + part).replace(/\s+/g, '').toLowerCase();
        if (full.includes(nq) || nq.includes(full)) return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// 入力テキスト → 規格番号リスト（クイック判定用）
// ---------------------------------------------------------------------------

/**
 * 営業が貼り付ける自由テキスト（改行・カンマ・セミコロン・タブ区切り、番号付き行など）を規格番号の配列にする。
 */
export function splitStandardsInput(text, limit = 200) {
  if (Array.isArray(text)) text = text.join('\n');
  const seen = new Set();
  const out = [];
  for (let line of String(text || '').split(/[\n\r,;\t]+/)) {
    line = line.replace(/^\s*(?:[-*•・]|\d+[.)])\s*/, '').trim();
    if (!line) continue;
    const key = line.replace(/\s+/g, ' ').toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= limit) break;
  }
  return out;
}
