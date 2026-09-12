// EC 公式 Excel（整合規格サマリーリスト）の解析（旧 standards.js の parseStandardsFromExcelData / convertExcelDate を移植）
import * as XLSX from 'xlsx';

const LEGISLATION = { EMC: '2014/30/EU', RED: '2014/53/EU', LVD: '2014/35/EU' };

const str = v => (v === undefined || v === null ? '' : String(v).trim());

/** Excel シリアル日付（例: 45809）→ "YYYY-MM-DD"。それ以外はそのまま返す */
export function convertExcelDate(value) {
  const s = str(value);
  if (!s || s === '-') return '';
  if (/^\d{4,5}$/.test(s)) {
    const serial = parseInt(s, 10);
    if (serial > 40000 && serial < 50000) {
      const d = new Date(Date.UTC(1899, 11, 30));
      d.setUTCDate(d.getUTCDate() + serial);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    }
  }
  return s;
}

/** xlsx バイト列 → 行配列（1 シート目、header:1） */
export function readRows(bytes) {
  const wb = XLSX.read(bytes, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1 });
}

/** 行配列 → 規格オブジェクト配列（旧 API とフィールド互換） */
export function parseStandardsFromRows(rows, directive) {
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;

    const standardNumber = str(row[2]);
    const title = str(row[3]);
    const versionOrDate = str(row[4]);
    const notes = str(row[5]);
    if (!standardNumber || !standardNumber.includes('EN')) continue;

    let cleanNumber = standardNumber;
    let version = '';
    let date = '';
    if (versionOrDate) {
      if (/^\d{4,5}$/.test(versionOrDate)) {
        const serial = parseInt(versionOrDate, 10);
        if (serial > 40000 && serial < 50000) {
          date = convertExcelDate(versionOrDate);
          version = date.slice(0, 4);
        } else {
          date = versionOrDate;
          version = versionOrDate;
        }
      } else if (versionOrDate.includes('V')) {
        version = versionOrDate;
      } else if (/\d{4}/.test(versionOrDate)) {
        date = versionOrDate.match(/\d{4}/)[0];
        version = versionOrDate;
      }
    }

    const amendment = standardNumber.match(/\(\+A\d+\)|\+A\d+/);
    if (amendment) cleanNumber = `${standardNumber.replace(amendment[0], '').trim()} ${amendment[0]}`;
    if (standardNumber.includes('(+AC)')) cleanNumber = `${standardNumber.replace('(+AC)', '').trim()} (+AC)`;

    const fullNumber = version && version.startsWith('V') ? `${cleanNumber} ${version}` : cleanNumber;

    out.push({
      number: cleanNumber,
      full_number: fullNumber,
      title,
      description: title,
      version: version || date,
      date,
      type: 'Harmonised Standard',
      notes,
      legislation_reference: LEGISLATION[directive] || '',
      eso: str(row[1]),
      oj_reference: str(row[5]),
      restriction: str(row[6]),
      withdrawal_date: convertExcelDate(row[9]),
      withdrawal_reference: str(row[10]),
      date_of_start_presumption: convertExcelDate(row[4]),
      restriction_date: convertExcelDate(row[7]),
      withdrawal_date_col_j: convertExcelDate(row[9]),
      oj_reference_col_f: str(row[5]),
      oj_reference_col_i: str(row[8]),
      oj_reference_col_k: str(row[10]),
    });
  }
  return out;
}

export function parseStandardsFromXlsx(bytes, directive) {
  return parseStandardsFromRows(readRows(bytes), directive);
}
