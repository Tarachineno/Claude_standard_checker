// EU Harmonized Standards Checker — Cloudflare Workers エントリポイント
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

const api = new Hono();

// CORS preflight（旧 Functions は各ハンドラで OPTIONS を処理していた）
api.options('*', c => c.body(null, 204, CORS_HEADERS));

api.route('/', meta);
api.route('/', standards);
api.route('/', scopes);
api.route('/', quickCheck);

const app = new Hono();
app.route('/api', api);
app.route('/.netlify/functions', api);

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

export default app;
