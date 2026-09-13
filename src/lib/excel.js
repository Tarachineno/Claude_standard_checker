// EC 公式 Excel（整合規格サマリーリスト）の解析（旧 standards.js の parseStandardsFromExcelData / convertExcelDate を移植）
import * as XLSX from 'xlsx';
import { parseStandardReferences, unique } from './references.js';
import { splitOjReferenceText } from './oj-reference.js';

const LEGISLATION = { EMC: '2014/30/EU', RED: '2014/53/EU', LVD: '2014/35/EU' };

const str = v => (v === undefined || v === null ? '' : String(v).trim());

/** Excel シリアル日付（例: 45809）→ "YYYY-MM-DD"。それ以外はそのまま返す */
export function convertExcelDate(value) {
  const s = str(value);
  if (!s || s === '-') return '';
  const european = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (european) return `${european[3]}-${european[2]}-${european[1]}`;
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
  // Locate the header: current exports have a generated-date preamble and no
  // separate title column. Never silently interpret an unknown layout by index.
  const headerIndex = rows.findIndex(row => row.some(v => /^(Reference number of the standard|Reference and title)/i.test(str(v))));
  if (headerIndex < 0) throw new Error('Unsupported EC Excel header');
  const header = rows[headerIndex].map(str);
  const combined = header.some(v => /^Reference and title/i.test(v));
  const column = pattern => header.findIndex(v => pattern.test(v));
  const columns = combined ? {
    number: column(/^Reference and title/i), eso: column(/^ESO$/i),
    start: column(/^Start of legal effect$/i), end: column(/^End of legal effect$/i),
    oj: column(/^Publication OJ reference$/i), withdrawalOj: column(/^Withdrawal OJ reference$/i),
    decision: column(/^Publication Decision reference$/i), withdrawalDecision: column(/^Withdrawal Decision reference$/i),
    publicationDate: column(/^Publication OJ date$/i), withdrawalDate: column(/^Withdrawal OJ date$/i),
  } : {
    number: column(/^Reference number of the standard/i), title: column(/^Title of the standard/i), eso: column(/^ESO\b/i),
    start: column(/^Date of start of presumption of conformity \(/i),
    end: column(/^Date of withdrawal from OJ/i), oj: column(/^OJ reference for publication in OJ/i),
    restriction: column(/^Restriction\b/i), restrictionDate: column(/^Date of start.*with restriction/i),
    restrictionOj: column(/^OJ reference for publication of a restriction/i), withdrawalOj: column(/^OJ reference for withdrawal/i),
  };
  for (const key of ['number', 'eso', 'start', 'end', 'oj', 'withdrawalOj', ...(combined ? [] : ['title', 'restriction', 'restrictionDate', 'restrictionOj'])]) {
    if (columns[key] < 0) throw new Error(`Unsupported EC Excel header: missing ${key}`);
  }
  const out = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;

    const cell = key => str(row[columns[key]]);
    const raw = cell('number');
    if (!/^(?:ETSI\s+)?EN\b/.test(raw)) continue;
    const separated = splitOjReferenceText(raw);
    const number = separated.number;
    const title = combined ? separated.title : cell('title');
    // Edition identifiers come from the reference, never OJ publication dates.
    // Keep +A1:2020 intact instead of moving +A1 after the year.
    const version = unique(parseStandardReferences(number).flatMap(ref => ref.versions)).join(' / ');
    const date = convertExcelDate(cell('start'));
    const withdrawal = convertExcelDate(cell('end'));
    if ([date, withdrawal].some(d => d && (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(Date.parse(d))))) {
      throw new Error(`Invalid EC applicability date on row ${i + 1}`);
    }

    out.push({
      number,
      full_number: number,
      raw_reference: raw,
      title,
      description: title,
      version,
      date,
      type: 'Harmonised Standard',
      notes: cell('oj'),
      legislation_reference: LEGISLATION[directive] || '',
      eso: cell('eso'),
      oj_reference: cell('oj'),
      restriction: combined ? separated.restriction : cell('restriction'),
      withdrawal_date: withdrawal,
      withdrawal_reference: cell('withdrawalOj'),
      date_of_start_presumption: date,
      restriction_date: combined ? (separated.restriction ? date : '') : convertExcelDate(cell('restrictionDate')),
      withdrawal_date_col_j: withdrawal,
      oj_reference_col_f: cell('oj'),
      oj_reference_col_i: combined ? (separated.restriction ? cell('oj') : '') : cell('restrictionOj'),
      oj_reference_col_k: cell('withdrawalOj'),
      ...(combined ? {
        publication_decision_reference: cell('decision'), withdrawal_decision_reference: cell('withdrawalDecision'),
        publication_oj_date: convertExcelDate(cell('publicationDate')), withdrawal_oj_date: convertExcelDate(cell('withdrawalDate')),
      } : {}),
    });
  }
  return out;
}

export function parseStandardsFromXlsx(bytes, directive) {
  return parseStandardsWorkbook(bytes, directive).standards;
}

/** Source-document dates only: never use the download/check time as an update date. */
export function parseStandardsWorkbook(bytes, directive) {
  const wb = XLSX.read(bytes, { type: 'array' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  const generated = rows.slice(0, 5).flat().map(str).find(s => /^Generated\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}$/i.test(s));
  const generatedTime = generated ? Date.parse(generated.replace(/^Generated\s+/i, '') + ' UTC') : NaN;
  const modifiedTime = wb.Props?.ModifiedDate ? new Date(wb.Props.ModifiedDate).getTime() : NaN;
  return {
    standards: parseStandardsFromRows(rows, directive),
    sourceUpdatedAt: Number.isFinite(generatedTime) ? new Date(generatedTime).toISOString().slice(0, 10)
      : Number.isFinite(modifiedTime) ? new Date(modifiedTime).toISOString() : null,
    sourceUpdatedKind: Number.isFinite(generatedTime) ? 'xlsx_generated' : Number.isFinite(modifiedTime) ? 'xlsx_modified' : null,
  };
}
