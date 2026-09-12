#!/usr/bin/env node
// static/data/{a2la,jab}-scopes.md のフォーマット検証。
// 証明書更新・スコープ追加・ラボ追加の手編集で壊れやすい箇所を、D1へ流し込む前に機械的に検知する。
//
//   使い方:  node scripts/validate-scopes.mjs
//            npm run validate                  # 同じ
//   db:seed / db:seed:local は自動でこれを先に実行し、エラーがあれば投入を中止する。
//
// フォーマットのルールは static/data/SCOPE_FORMAT.md を参照。

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseScopesDocument } from '../src/lib/md.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let hasError = false;
const errors = [];
const warnings = [];

function err(certType, msg) { errors.push(`[${certType}] ${msg}`); hasError = true; }
function warn(certType, msg) { warnings.push(`[${certType}] ${msg}`); }

function isValidDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s));
}

for (const certType of ['a2la', 'jab']) {
  const rel = `static/data/${certType}-scopes.md`;
  let md;
  try {
    md = readFileSync(join(root, rel), 'utf8');
  } catch {
    err(certType, `${rel} が見つからない`);
    continue;
  }

  const doc = parseScopesDocument(md, certType);

  // 1) 必須メタ情報
  for (const key of ['certificate_number', 'organization', 'valid_until', 'accreditation_body']) {
    if (!doc.info[key]) err(certType, `メタ情報 "${key}" が空（ファイル冒頭の **Key:** Value 行を確認）`);
  }

  // 2) Valid Until の日付妥当性・期限
  if (doc.info.valid_until) {
    if (!isValidDate(doc.info.valid_until)) {
      err(certType, `Valid Until "${doc.info.valid_until}" が YYYY-MM-DD 形式ではない`);
    } else {
      const daysLeft = Math.floor((Date.parse(doc.info.valid_until) - Date.now()) / 86400000);
      if (daysLeft < 0) err(certType, `認定の有効期限が切れている（Valid Until: ${doc.info.valid_until}）`);
      else if (daysLeft < 90) warn(certType, `認定の有効期限まで残り${daysLeft}日（Valid Until: ${doc.info.valid_until}） — そろそろ更新の準備を`);
    }
  }

  // 3) アンカー重複（1つの #anchor が異なる見出し=カテゴリに使われていないか）
  //    実際に jab-scopes.md で発生した事故: 別カテゴリの見出しに同じ {#...} を貼ってしまい、
  //    「詳細を見る」が別カテゴリの中身を表示してしまう。
  const anchorToCategories = new Map();
  for (const it of doc.items) {
    if (!it.anchor) continue;
    if (!anchorToCategories.has(it.anchor)) anchorToCategories.set(it.anchor, new Set());
    anchorToCategories.get(it.anchor).add(it.category || '(no category)');
  }
  for (const [anchor, cats] of anchorToCategories) {
    if (cats.size > 1) {
      err(certType, `アンカー "${anchor}" が異なる見出しで重複使用されている: ${[...cats].join(' / ')} — 見出し行の {#...} を書き換えて一意にする`);
    }
  }

  // 4) 施設番号の重複（JAB のみ）
  const facilityNumbers = new Map();
  for (const f of doc.facilities) {
    facilityNumbers.set(f.facility_number, (facilityNumbers.get(f.facility_number) || 0) + 1);
  }
  for (const [num, count] of facilityNumbers) {
    if (count > 1) err(certType, `施設番号 "${num}" が${count}回登場している（【施設${num}】の見出しが重複）`);
  }

  // 5) 完全重複する規格項目（同じ施設・同じカテゴリに同じ規格番号が複数回）
  const itemKeyCounts = new Map();
  for (const it of doc.items) {
    const key = `${it.facility_number || ''}|${it.category || ''}|${it.standard}`;
    itemKeyCounts.set(key, (itemKeyCounts.get(key) || 0) + 1);
  }
  for (const [key, count] of itemKeyCounts) {
    if (count > 1) {
      const [fac, cat, standard] = key.split('|');
      warn(certType, `"${standard}" が同じ区分内で${count}回重複（施設${fac || '-'} / ${cat}） — コピペミスの可能性`);
    }
  }

  // 6) 空カテゴリ（見出しはあるが規格 0 件）— categories は見出しを見た時点で記録されるため items 側と突き合わせる
  const categoriesWithItems = new Set(doc.items.map(i => i.category).filter(Boolean));
  for (const cat of doc.categories) {
    if (!categoriesWithItems.has(cat)) warn(certType, `見出し "${cat}" に規格が1件も無い`);
  }

  console.log(`[${certType}] ${rel}: ${doc.items.length}件 / 施設${doc.facilities.length} / 区分${doc.categories.length}`);
}

console.log('');
if (warnings.length) {
  console.log(`--- 警告 ${warnings.length}件（投入は続行できる。確認推奨） ---`);
  for (const w of warnings) console.log(`  ! ${w}`);
}
if (errors.length) {
  console.log(`--- エラー ${errors.length}件（このまま db:seed すると照合結果がおかしくなる） ---`);
  for (const e of errors) console.log(`  x ${e}`);
  console.log('');
  console.log('修正してから再実行すること。');
  process.exit(1);
}
console.log(warnings.length ? '\nエラーなし。警告のみ — 投入して問題ない。' : '\n問題なし。');
