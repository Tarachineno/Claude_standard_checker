// Node 上で Worker を動かすための最小モック環境（ASSETS = static/ をファイルから配信、KV/D1 は無し）
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const staticDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'static');

export const mockAssets = {
  async fetch(req) {
    const url = new URL(typeof req === 'string' ? req : req.url);
    const file = join(staticDir, decodeURIComponent(url.pathname));
    if (!file.startsWith(staticDir) || !existsSync(file)) return new Response('not found', { status: 404 });
    return new Response(readFileSync(file));
  },
};

/** 超簡易 KV モック */
export function mockKV() {
  const store = new Map();
  return {
    store,
    async get(key, type) {
      if (!store.has(key)) return null;
      const v = store.get(key);
      if (type === 'json') return JSON.parse(v);
      if (type === 'arrayBuffer') return v;
      return v;
    },
    async put(key, value) { store.set(key, value); },
  };
}

export const env = { ASSETS: mockAssets, STANDARDS_RECHECK_SECONDS: '21600', SCOPE_SOURCE_BRANCH: 'test' };
