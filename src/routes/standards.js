// OJ 整合規格まわり: /directives /standards /download-excel /search /compare /batch-compare
import { Hono } from 'hono';
import { ok, fail, CORS_HEADERS } from '../lib/http.js';
import { loadDirectives, getDirectiveConfig, getStandards, resolveExcelUrl, downloadExcel, DIRECTIVES } from '../lib/standards.js';

const app = new Hono();

// GET /api/directives
app.get('/directives', async c => {
  try {
    const data = await loadDirectives(c);
    return c.json({ success: true, data }, 200, CORS_HEADERS);
  } catch (err) {
    return fail(c, 500, 'Directives configuration file not found. Please ensure directives.json is available.');
  }
});

// GET /api/standards?directive=EMC|RED|LVD[&refresh=1]
app.get('/standards', async c => {
  const directive = (c.req.query('directive') || '').toUpperCase();
  const config = await getDirectiveConfig(c, directive);
  if (!directive || !config) {
    return fail(c, 400, `Invalid directive code. Use EMC, RED, or LVD.`);
  }
  try {
    const r = await getStandards(c, directive, { forceRefresh: c.req.query('refresh') === '1' });

    // 「新着あり」バナー: 前回追加検知（lastUpdated）からの経過日数が設定値未満なら表示する
    const bannerDays = Number(c.env.STANDARDS_BANNER_DAYS || 7);
    let showBanner = false, bannerDaysLeft = 0;
    if (r.lastUpdated && r.lastAdded?.length) {
      const elapsedMs = Date.now() - Date.parse(r.lastUpdated);
      const remainingMs = bannerDays * 86400000 - elapsedMs;
      showBanner = remainingMs > 0;
      bannerDaysLeft = showBanner ? Math.ceil(remainingMs / 86400000) : 0;
    }

    return c.json({
      success: true,
      data: {
        directive,
        directive_name: config.name,
        standards: r.standards,
        count: r.standards.length,
        update_available: r.updateAvailable,
        added_standards: r.added,
        excel_filename: r.excelFilename,
        // 追加（旧 API には無い運用情報）
        source: r.source,
        last_modified: r.lastModified,
        last_checked: r.lastChecked,
        last_updated: r.lastUpdated,
        last_added: r.lastAdded,
        show_banner: showBanner,
        banner_days_left: bannerDaysLeft,
      },
      ...(r.source === 'fallback' || r.source === 'bundled' || r.source === 'kv-stale' ? { note: `Using cached data (${r.source})` } : {}),
    }, 200, CORS_HEADERS);
  } catch (err) {
    console.error('[standards]', err);
    return fail(c, 500, `Failed to load standards: ${err.message}`);
  }
});

// GET /api/download-excel?directive=EMC  — EC 公式 Excel をそのまま返す（失敗時は KV/同梱キャッシュ）
app.get('/download-excel', async c => {
  const directive = (c.req.query('directive') || '').toUpperCase();
  const config = await getDirectiveConfig(c, directive);
  if (!directive || !config || !config.excel_url) {
    return fail(c, 400, 'Invalid directive code. Use EMC, RED, or LVD.');
  }
  const today = new Date().toISOString().slice(0, 10);
  const filename = `EU_Harmonised_Standards_${directive}_${today}.xlsx`;
  const headers = {
    ...CORS_HEADERS,
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'public, max-age=3600',
  };
  try {
    const url = await resolveExcelUrl(config);
    const { bytes } = await downloadExcel(url, directive);
    return new Response(bytes, { status: 200, headers });
  } catch (err) {
    console.error('[download-excel] EC failed, trying cache:', err.message);
    const cached = c.env.CACHE ? await c.env.CACHE.get(`xlsx:${directive}`, 'arrayBuffer') : null;
    if (cached) return new Response(cached, { status: 200, headers: { ...headers, 'X-Source': 'kv' } });
    const bundled = await c.env.ASSETS.fetch(new Request(new URL(`/data/${directive}.xlsx`, c.req.url)));
    if (bundled.ok) return new Response(await bundled.arrayBuffer(), { status: 200, headers: { ...headers, 'X-Source': 'bundled' } });
    return fail(c, 500, `Excel download failed: ${err.message}`);
  }
});

// GET /api/search?q=  — 3 指令を横断して番号・タイトルを部分一致検索
app.get('/search', async c => {
  const query = (c.req.query('q') || '').trim();
  if (query.length < 2) return fail(c, 400, 'Search query must be at least 2 characters long');
  const ql = query.toLowerCase();
  const results = [];
  for (const directive of DIRECTIVES) {
    try {
      const config = await getDirectiveConfig(c, directive);
      const r = await getStandards(c, directive);
      for (const s of r.standards) {
        if (s.number.toLowerCase().includes(ql) || (s.title || '').toLowerCase().includes(ql)) {
          results.push({ ...s, directive, directive_name: config?.name || directive });
        }
      }
    } catch (err) {
      console.error(`[search] ${directive}:`, err.message);
    }
  }
  results.sort((a, b) => {
    const ae = a.number.toLowerCase() === ql, be = b.number.toLowerCase() === ql;
    if (ae && !be) return -1;
    if (!ae && be) return 1;
    return a.number.localeCompare(b.number);
  });
  return ok(c, { query, results, count: results.length });
});

// ---- compare / batch-compare（旧 API 互換。iso_standards: [{standard_number}] ）----

function normalizeNumber(n) {
  return String(n || '').trim().toUpperCase().replace(/\s+/g, ' ').replace(/V\d+\.\d+\.\d+.*$/, '').replace(/:\d+.*$/, '').trim();
}

async function compareWithDirective(c, directive, isoStandards) {
  const config = await getDirectiveConfig(c, directive);
  const { standards: oj } = await getStandards(c, directive);
  const matched = [], ojOnly = [], isoOnly = [...isoStandards];
  for (const o of oj) {
    const m = isoStandards.find(i => normalizeNumber(o.number) === normalizeNumber(i.standard_number));
    if (m) {
      matched.push({ oj_standard: o, iso_standard: m });
      const idx = isoOnly.findIndex(i => normalizeNumber(i.standard_number) === normalizeNumber(m.standard_number));
      if (idx > -1) isoOnly.splice(idx, 1);
    } else {
      ojOnly.push(o);
    }
  }
  return {
    directive,
    directive_name: config?.name || directive,
    matched_standards: matched,
    matched_count: matched.length,
    oj_only_standards: ojOnly,
    iso_only_standards: isoOnly,
    oj_count: oj.length,
    iso_count: isoStandards.length,
    coverage_percentage: isoStandards.length ? (matched.length / isoStandards.length) * 100 : 0,
    comparison_date: new Date().toISOString(),
  };
}

app.post('/compare', async c => {
  let body;
  try { body = await c.req.json(); } catch { return fail(c, 400, 'Invalid JSON body'); }
  const { directive, iso_standards } = body || {};
  if (!directive || !Array.isArray(iso_standards)) return fail(c, 400, 'Missing directive or ISO standards data');
  try {
    return ok(c, await compareWithDirective(c, String(directive).toUpperCase(), iso_standards));
  } catch (err) {
    console.error('[compare]', err);
    return fail(c, 500, 'Comparison failed');
  }
});

app.post('/batch-compare', async c => {
  let body;
  try { body = await c.req.json(); } catch { return fail(c, 400, 'Invalid JSON body'); }
  const { iso_standards } = body || {};
  if (!Array.isArray(iso_standards)) return fail(c, 400, 'Missing or invalid ISO standards data');
  const results = {};
  let bestDirective = null, bestCoverage = 0;
  for (const directive of DIRECTIVES) {
    try {
      const r = await compareWithDirective(c, directive, iso_standards);
      results[directive] = r;
      if (r.coverage_percentage > bestCoverage) { bestCoverage = r.coverage_percentage; bestDirective = directive; }
    } catch (err) {
      results[directive] = { directive, matched_standards: [], matched_count: 0, coverage_percentage: 0, error: 'Comparison failed' };
    }
  }
  return ok(c, { results, best_directive: bestDirective, best_coverage: bestCoverage, total_iso_standards: iso_standards.length, comparison_date: new Date().toISOString() });
});

export default app;
