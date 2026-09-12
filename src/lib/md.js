// 認定スコープ MD（static/data/{a2la,jab}-scopes.md）のパーサ
// Worker（実行時のフォールバック）と scripts/seed-from-md.mjs（D1 投入）の両方から使う純粋関数。
// 出力形状は旧 netlify/functions/utils/md.js と互換。

const META_LINE = /^\*\*([^*]+):\*\*\s*(.*)$/;
const FACILITY_LINE = /【施設(\d+)】(.+?)（(.+)）/;
const SECTION_LINE = /^### (.+?) \{#([^}]+)\}/;
const FACILITY_ANCHOR = /\{#([^}]+)\}\s*$/;
const ITEM_LINE = /^- \*\*([^*]+)\*\*\s*-?\s*(.*)$/;

const META_KEYS = {
  'Certificate Number': 'certificate_number',
  'Organization': 'organization',
  'Valid Until': 'valid_until',
  'Accreditation Body': 'accreditation_body',
};

/**
 * MD 全体を 1 回で構造化する。D1 シードと API の両方の元データになる。
 * @returns {{ info: object, facilities: Array, items: Array, categories: string[] }}
 */
export function parseScopesDocument(mdContent, certType) {
  const lines = String(mdContent).split('\n');
  const info = {};
  const facilities = [];
  const items = [];
  const categoriesSeen = new Set();

  let facility = null;
  let category = null;
  let anchor = null;
  let inMetadata = true;
  let order = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (inMetadata) {
      const m = line.match(META_LINE);
      if (m) {
        const key = m[1].trim();
        const value = m[2].trim();
        info[META_KEYS[key] || key.toLowerCase().replace(/\s+/g, '_')] = value;
        continue;
      }
    }
    if (line.startsWith('## ') || line.startsWith('### ')) inMetadata = false;

    if (certType === 'jab' && line.includes('【施設') && line.includes('】')) {
      const fm = line.match(FACILITY_LINE);
      if (fm) {
        const am = line.match(FACILITY_ANCHOR);
        facility = {
          facility_number: fm[1],
          name: fm[2].trim(),
          location: fm[3].trim(),
          anchor: am ? `#${am[1]}` : null,
        };
        facilities.push(facility);
        continue;
      }
    }

    const sm = line.match(SECTION_LINE);
    if (sm) {
      category = sm[1].trim();
      anchor = `#${sm[2]}`;
      categoriesSeen.add(category);
      continue;
    }

    if (line.startsWith('- **')) {
      const im = line.match(ITEM_LINE);
      if (im) {
        items.push({
          standard: im[1].trim(),
          description: im[2].trim(),
          category,
          anchor,
          facility_number: facility ? facility.facility_number : null,
          sort_order: order++,
        });
      }
    }
  }

  return { info, facilities, items, categories: [...categoriesSeen] };
}

/** 旧 parseMDToScopeData 互換：照合・検索用のフラットな配列 */
export function parseMDToScopeData(mdContent, certType) {
  const doc = parseScopesDocument(mdContent, certType);
  return { scopes: toMatcherScopes(doc) };
}

/** 旧 parseCertificateMD 互換：画面表示用の入れ子構造 */
export function parseCertificateMD(mdContent, certType) {
  const doc = parseScopesDocument(mdContent, certType);
  return toCertificateData(doc, certType);
}

/** 構造化データ → 照合用配列（facility は "施設1: 名前" 形式の文字列） */
export function toMatcherScopes(doc) {
  const facilityName = new Map(doc.facilities.map(f => [f.facility_number, `施設${f.facility_number}: ${f.name}`]));
  return doc.items.map(it => ({
    standard: it.standard,
    description: it.description,
    anchor: it.anchor,
    facility: it.facility_number ? facilityName.get(it.facility_number) || null : null,
  }));
}

/** 構造化データ → certificate-data API のレスポンス形状 */
export function toCertificateData(doc, certType) {
  const data = {
    certificate_info: { ...doc.info },
    test_standards: [],
    categories: {},
    certificate_type: `${certType.toUpperCase()}_MD_Dynamic`,
  };
  const facilityMap = new Map();
  if (doc.facilities.length) {
    data.facilities = doc.facilities.map(f => {
      const entry = { facility_number: f.facility_number, name: f.name, location: f.location, standards: [] };
      facilityMap.set(f.facility_number, entry);
      return entry;
    });
  }
  for (const it of doc.items) {
    const entry = { standard: it.standard, description: it.description, category: it.category, anchor: it.anchor };
    data.test_standards.push(entry);
    if (it.category) {
      (data.categories[it.category] ||= []).push(entry);
    }
    if (it.facility_number && facilityMap.has(it.facility_number)) {
      facilityMap.get(it.facility_number).standards.push(entry);
    }
  }
  data.total_standards = data.test_standards.length;
  return data;
}
