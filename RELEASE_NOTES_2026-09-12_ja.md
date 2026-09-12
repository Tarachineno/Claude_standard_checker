# リリースノート 2026-09-12 — v3.0 Cloudflare Workers 版

ブランチ: `cloudflare-workers`

## 概要

Netlify（Functions + Hosting）から Cloudflare（Workers + Static Assets + D1 + KV）へ移設。画面と API の互換性を保ったまま、営業向けの「クイック判定」タブと、認定スコープの D1 データベース化、Cloudflare Access によるアクセス制御を追加した。

## 追加

- **クイック判定タブ**（トップ・既定表示）
  - 規格番号を複数貼り付け → JAB / A2LA の認定範囲判定（OK / 要確認 / NG）と、OJ 整合規格リスト（EMC / RED / LVD）の掲載状況を一覧表示
  - 表をコピー（TSV）、CSV 出力、印刷レイアウト
  - `POST /api/quick-check`
- **D1 データベース**（`migrations/0001_init.sql`）
  - `certificates` / `facilities` / `scope_items`。MD の内容ハッシュ単位で改訂を保持し、古い改訂は `is_current = 0` で履歴として残る
  - `scripts/seed-from-md.mjs`: MD → SQL（冪等）。`npm run db:seed`
  - `GET /api/scopes/status`: 投入状況の確認
  - 未シード時は従来どおり MD を直接読む（フォールバック）
- **Cloudflare Access 対応**: `GET /api/me` がログインユーザーのメールを返し、画面右上に表示
- `GET /api/health`
- 自動テスト `npm test`（22 件: パーサ / 照合ロジック / Excel 解析 / API 結合）

## 変更

- API のベースパスを `/api` に変更（`/.netlify/functions/*` は互換エイリアスとして残置）
- EC 公式 Excel のキャッシュをローカルディスクから KV へ。EC への更新確認は 6 時間に 1 回（`STANDARDS_RECHECK_SECONDS`）。KV 未設定・EC 到達不可でも同梱 Excel で動作
- `/api/standards` に `source` / `last_checked` / `last_updated` / `last_added` を追加
- `/api/certificate-data` に `total_standards` / `source` / `imported_at` を追加（読込完了メッセージの「undefined standards」表示を修正）
- HTML パースを cheerio から正規表現ベースに置換（依存削減。EC ページはサーバー描画のため十分）

## 照合ロジックの修正（結果が変わる箇所）

1. `EN 55032:2015` vs スコープ `EN 55032` → 旧「表記違い(EN :/EN)」→ 新「バージョン包括(2015)」（年版の `:` が残るバグ）
2. 同じ番号が複数項目に当たる場合は最も良い一致を返す（旧: 最初の項目）。例: A2LA で `EN 61000-4-2:2009` → 旧「表記違い(EN/IEC)」→ 新「バージョン包括(2009)」
3. スコープ検索で空白入り範囲表記（`EN 302 065-1 / -2 / -3 / -4` に対する `302 065-2`）と包括表記の部番（`489-52`）がヒットするように
4. 大小文字・連続空白の違いを無視

いずれも旧版では緑バッジだった項目が緑のまま注記だけ正確になる方向の変更。赤→緑に変わるのは 3 の検索のみ。

## 削除

- `netlify/`、`netlify.toml`
- `eng.traineddata`、`jpn.traineddata`（8MB、未使用）
- `.DS_Store`

## 移行手順

README「☁️ Cloudflare Workers 版」を参照。

## 2026-09-12 追加修正（`d79c404`〜`52bc698`）

- OJ 整合規格の新着バナーを追加。新規追加の検知から既定7日間表示し、閉じるボタンを備える。表示日数は `wrangler.jsonc` の `STANDARDS_BANNER_DAYS` で変更可能。
- 証明書タブを D1 / 証明書 PDF 参照に対応。カテゴリ・施設別一覧の規格から詳細モーダルを開け、証明書情報欄にも Cloudflare 上の PDF リンクを表示する。API の `anchor` も保持する。
- OJ 規格の版違い表示を「版違い」に統一。バックエンドの判定結果 note とフロントエンドの表示テンプレートを含む。
- `scripts/validate-scopes.mjs` と `static/data/SCOPE_FORMAT.md` を追加。必須項目、有効期限、アンカー・施設番号・規格重複、空カテゴリを検査し、`db:seed` 実行前に自動検証する。
- `jab-scopes.md` の重複アンカーを修正し、本番 D1 を再シード済み。JAB 1,050件、施設2件を反映。
