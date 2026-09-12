// Lab Scope Checker — Cloudflare Workers エントリポイント
//
//   静的ファイル（static/）は Workers Static Assets が先に配信し、一致しないパスだけがここに届く。
//   API は /api/* に集約。旧 Netlify 版のパス（/.netlify/functions/*）も同じルーターに向けてあるので、
//   README の Integration Examples にある外部連携は書き換え無しで動く。

import { Hono } from 'hono';
import { CORS_HEADERS } from './lib/http.js';
import standards from './routes/standards.js';
import scopes from './routes/scopes.js';
import quickCheck from './routes/quick-check.js';
import meta from './routes/meta.js';
import catalog from './routes/catalog.js';

const api = new Hono();

// CORS preflight（旧 Functions は各ハンドラで OPTIONS を処理していた）
api.options('*', c => c.body(null, 204, CORS_HEADERS));

api.route('/', meta);
api.route('/', standards);
api.route('/', scopes);
api.route('/', quickCheck);
api.route('/', catalog);

const app = new Hono();
app.route('/api', api);
app.route('/.netlify/functions', api);

// Markdown の日本語表示用。Static Assets の既定レスポンスには charset が付かないため、
// .md は Worker 経由で UTF-8 を明示して返す（HTML / JS / PDF は従来どおり直接配信）。
app.get('/data/:filename', async c => {
  const filename = c.req.param('filename') || '';
  if (!filename.toLowerCase().endsWith('.md')) return c.notFound();

  const asset = await c.env.ASSETS.fetch(new Request(new URL(c.req.path, c.req.url)));
  if (!asset.ok) return c.notFound();

  const headers = new Headers(asset.headers);
  headers.set('Content-Type', 'text/markdown; charset=utf-8');
  headers.set('Content-Disposition', 'inline');
  return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
});

const isApi = c => c.req.path.startsWith('/api/') || c.req.path.startsWith('/.netlify/functions/');

// notFound / onError はサブアプリでは効かないのでトップレベルで振り分ける
app.notFound(c => isApi(c)
  ? c.json({ success: false, error: `Unknown API endpoint: ${c.req.path}` }, 404, CORS_HEADERS)
  : c.text('Not found', 404));

app.onError((err, c) => {
  console.error('[api] unhandled', err);
  return isApi(c)
    ? c.json({ success: false, error: err.message || 'Internal error' }, 500, CORS_HEADERS)
    : c.text('Internal error', 500);
});

export default {
  fetch: app.fetch,
  // Keep app.request for Node integration tests.
  request: app.request.bind(app),
};
