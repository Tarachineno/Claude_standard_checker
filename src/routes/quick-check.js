// POST /api/quick-check — 営業向けクイック判定
//
//   入力: { text: "EN 55032:2015\nEN 301 489-17, ..." }  または { standards: [...] }
//   出力: 規格ごとに JAB / A2LA の認定範囲判定（ok / check / ng）と OJ 整合規格リスト（EMC/RED/LVD）での掲載状況
//
//   verdict の意味（営業向け 3 段階）
//     ok    … 認定範囲内（完全一致 / 年版のみ違い(スコープ側に年版なし) / 包括表記に含まれる / 表記違いのみ）
//     check … 認定書に年版付きで載っていて、問い合わせの年版と違う → エンジニアに確認
//     ng    … JAB・A2LA どちらの認定範囲にも見当たらない
import { Hono } from 'hono';
import { ok, fail } from '../lib/http.js';
import { loadScopes, loadScopeDocument } from '../lib/scopes.js';
import { findScopeMatch, findAllScopeMatches, verdictOf, splitStandardsInput, extractStandardCore, extractVersion } from '../lib/matcher.js';
import { getStandards, DIRECTIVES } from '../lib/standards.js';
import { parseStandardReferences } from '../lib/references.js';
import { isActiveOjEntry } from '../lib/scope-oj.js';

const app = new Hono();
const RANK = { ok: 0, check: 1, ng: 2 };

function ojStatusOf(entries, today) {
  if (!entries.length) return 'not_listed';
  const active = entries.some(e => isActiveOjEntry(e, today));
  return active ? 'harmonised' : 'withdrawn';
}

app.post('/quick-check', async c => {
  let body;
  try { body = await c.req.json(); } catch { return fail(c, 400, 'Invalid JSON body'); }
  const inputs = splitStandardsInput(body?.standards ?? body?.text ?? '');
  if (!inputs.length) return fail(c, 400, '規格番号を 1 つ以上入力してください');

  const wantDirectives = Array.isArray(body?.directives) && body.directives.length
    ? body.directives.map(d => String(d).toUpperCase()).filter(d => DIRECTIVES.includes(d))
    : DIRECTIVES;

  try {
    const [jabDoc, a2laDoc] = await Promise.all([loadScopeDocument(c, 'jab'), loadScopeDocument(c, 'a2la')]);
    const [jab, a2la] = await Promise.all([loadScopes(c, 'jab'), loadScopes(c, 'a2la')]);

    // OJ リスト（指令ごと）。core → entries の索引を作る
    const ojIndex = new Map();
    const ojSources = {};
    for (const d of wantDirectives) {
      try {
        const r = await getStandards(c, d);
        ojSources[d] = { source: r.source, last_modified: r.lastModified, source_updated_at: r.sourceUpdatedAt, source_updated_kind: r.sourceUpdatedKind, count: r.standards.length };
        for (const s of r.standards) {
          const core = parseStandardReferences(s.full_number || s.number)[0]?.key;
          if (!core) continue;
          const list = ojIndex.get(core) || [];
          list.push({ directive: d, number: s.number, full_number: s.full_number, title: s.title, version: s.version, date: s.date,
            date_of_start_presumption: s.date_of_start_presumption, withdrawal_date: s.withdrawal_date, oj_reference: s.oj_reference, restriction: s.restriction });
          ojIndex.set(core, list);
        }
      } catch (err) {
        ojSources[d] = { error: err.message };
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const items = inputs.map(input => {
      const j = findScopeMatch(input, jab);
      const a = findScopeMatch(input, a2la);
      const jabAlt = findAllScopeMatches(input, jab).filter(m => m.matched_standard !== j.matched_standard || m.facility !== j.facility).slice(0, 5);
      const core = extractStandardCore(input);
      const version = extractVersion(input);
      const ref = parseStandardReferences(input)[0];
      let oj = ref ? (ojIndex.get(ref.key) || []) : [];
      if (version) {
        const exact = oj.filter(e => parseStandardReferences(e.full_number || e.number).some(r => r.key === ref?.key && r.versions.some(v => ref.versions.includes(v))));
        if (exact.length) oj = exact;
      }
      const ojVersionMatch = !!ref?.versions.length && oj.some(e => parseStandardReferences(e.full_number || e.number).some(r => r.key === ref.key && r.versions.some(v => ref.versions.includes(v))));
      const jv = verdictOf(j.status), av = verdictOf(a.status);
      const verdict = RANK[jv] <= RANK[av] ? jv : av;
      return {
        input,
        core,
        jab: { ...j, verdict: jv, alternatives: jabAlt },
        a2la: { ...a, verdict: av },
        oj: oj.map(e => ({ ...e, number: e.number.replace(/\s*,?\s*[\r\n]+\s*/g, ' / ') })),
        oj_status: ojStatusOf(oj, today),
        oj_version_match: ojVersionMatch,
        verdict,
      };
    });

    const summary = { ok: 0, check: 0, ng: 0, oj_listed: 0, oj_withdrawn: 0 };
    for (const it of items) {
      summary[it.verdict]++;
      if (it.oj_status === 'harmonised') summary.oj_listed++;
      if (it.oj_status === 'withdrawn') summary.oj_withdrawn++;
    }

    const certInfo = ({ doc, source, certificate }) => ({
      source, certificate_number: doc.info.certificate_number, valid_until: doc.info.valid_until,
      organization: doc.info.organization, imported_at: certificate?.imported_at || null, item_count: doc.items.length,
    });

    return ok(c, {
      checked_at: new Date().toISOString(),
      input_count: inputs.length,
      items,
      summary,
      sources: { jab: certInfo(jabDoc), a2la: certInfo(a2laDoc), oj: ojSources },
    });
  } catch (err) {
    console.error('[quick-check]', err);
    return fail(c, 500, `Quick check failed: ${err.message}`);
  }
});

export default app;
