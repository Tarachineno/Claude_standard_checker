// /api/me /api/health
import { Hono } from 'hono';
import { ok } from '../lib/http.js';

const app = new Hono();

// Cloudflare Access を前段に置くと、認証済みユーザーのメールが以下のヘッダで届く
app.get('/me', c => {
  const email = c.req.header('Cf-Access-Authenticated-User-Email') || null;
  return ok(c, { email, protected: !!email });
});

app.get('/health', c => ok(c, {
  status: 'healthy',
  timestamp: new Date().toISOString(),
  runtime: 'cloudflare-workers',
  bindings: { assets: !!c.env.ASSETS, d1: !!c.env.DB, kv: !!c.env.CACHE },
}));

export default app;
