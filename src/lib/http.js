// 共通の HTTP ヘルパー（旧 Netlify Functions で各ファイルに重複していた CORS / JSON 処理を集約）

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/** 成功レスポンス（旧 API と同じ { success: true, data } 形状） */
export function ok(c, data, extra = {}) {
  return c.json({ success: true, data, ...extra }, 200, CORS_HEADERS);
}

/** 失敗レスポンス（旧 API と同じ { success: false, error } 形状） */
export function fail(c, status, error, extra = {}) {
  return c.json({ success: false, error, ...extra }, status, CORS_HEADERS);
}

/** 静的アセット（static/ 配下）を Worker 内から読む */
export async function readAsset(c, path) {
  const url = new URL(path, c.req.url);
  const res = await c.env.ASSETS.fetch(new Request(url.toString()));
  if (!res.ok) throw new Error(`Asset not found: ${path} (${res.status})`);
  return res;
}

export async function readAssetText(c, path) {
  return (await readAsset(c, path)).text();
}

export async function readAssetJson(c, path) {
  return (await readAsset(c, path)).json();
}

export async function readAssetBytes(c, path) {
  return new Uint8Array(await (await readAsset(c, path)).arrayBuffer());
}
