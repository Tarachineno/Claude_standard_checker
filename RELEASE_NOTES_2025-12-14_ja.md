# リリースノート - 2025年12月14日

## 🎯 概要
このリリースでは、ECページからの動的Excelリンク抽出機能、国際化の改善、A2LAスコープマッチングの修正、ユーザーインターフェースの改善が含まれています。

## ✨ 主な機能

### 動的Excelリンク抽出機能
- **RED、EMC、LVD指令のECページからExcelファイルリンクを動的に抽出する機能を実装**
- ハードコードされた直接ダウンロードURLの代わりに、アプリケーションは以下を実行します：
  - EC整合規格ページを取得（例：`https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/radio-equipment_en`）
  - ページコンテンツからExcelファイルリンクを動的に抽出
  - `docsroom` JSON APIエンドポイントとHTMLページへのリダイレクトを処理
  - 必要に応じてドキュメントIDから直接ExcelダウンロードURLを構築
- **メリット**：
  - ECページのExcelファイルURLの変更に自動的に対応
  - ECがファイル構造を更新しても、手動でURLを更新する必要がない
  - より堅牢で保守しやすいソリューション
- **技術的実装**：
  - HTMLを解析してExcelリンクを抽出する`extractExcelLinkFromECPage()`関数を追加
  - `docsroom`リダイレクトを処理するために`fetchStandardsFromExcel()`を強化：
    - JSON APIレスポンスを検出し、JSON構造からExcel URLを抽出
    - HTMLページリダイレクトを検出し、ドキュメントIDパターンを使用してExcel URLを構築：`/docsroom/documents/{id}/attachments/1/translations/en/renditions/native`
    - ドキュメントID抽出が失敗した場合はHTML解析にフォールバック
  - `directives.json`を更新し、直接ダウンロードリンクの代わりにページURLを使用

### OJ更新通知
- 「規格取得」ボタンの下に多言語対応の通知ボックスを追加
- 最新のOJ情報が反映されていない可能性があることをユーザーに通知
- 手動確認のための公式ECページへの直接リンクを提供：
  - **RED**: 無線機器指令ページ
  - **EMC**: 電磁両立性指令ページ
  - **LVD**: 低電圧指令ページ
- 英語と日本語の両方の翻訳を完全サポート
- 視認性向上のためSGSカラーでスタイリング

### デフォルト言語設定
- デフォルト言語を英語から日本語に変更
- 新規ユーザーはデフォルトで日本語インターフェースを表示
- 言語設定はlocalStorageに保存され、セッション間で永続化
- 初期読み込み時に日本語がアクティブとして正しく表示されるように言語ボタンのハイライトを修正

### スコープマッチングノートの翻訳
- 英語モードでもスコープマッチングノートが日本語で表示される問題を修正
- フロントエンドにスコープマッチングノートの翻訳システムを追加
- ノートは現在の言語設定に基づいて自動的に翻訳されます：
  - 英語: "⚠️ Comprehensive scope applied (includes 489-17)"
  - 日本語: "⚠️ 包括スコープ適用(489-17含む)"
- すべてのノートタイプが翻訳されます：包括スコープ、バージョン不一致、バージョン許容、プレフィックス不一致、スコープ適用

## 🐛 バグ修正

### A2LAスコープマッチング
- A2LA証明書スコープ情報がFetch結果に正しく表示されない問題を修正
- **問題**: スペース区切りの包括スコープパターン（例：「EN 301 489-1 / -3 / -7 / -9 / -15 / -17 / -19 / -24 / -51 / -52」）がマッチされていませんでした
- **解決策**: `isComprehensiveScopeMatch()`関数を更新し、スペース区切り（" / -"）と非スペース区切り（"/-"）の両方のパターンを処理
- 正規表現パターンを更新し、「 / -」と「/-」の両方の形式にマッチ
- パート番号抽出を更新し、「-17」と「 / -17」の両方のパターンを処理
- EN 301 489-17などの規格が包括スコープエントリに対して正しくマッチされるようになりました

### 言語ボタンのハイライト
- デフォルト言語が日本語なのに英語ボタンがハイライトされる問題を修正
- **問題**: HTMLに英語ボタンにハードコードされた`active`クラスがあり、初期化時に`updateLanguageButtons()`が呼ばれていませんでした
- **解決策**：
  - HTMLからハードコードされた`active`クラスを削除
  - `initializeApp()`関数に`updateLanguageButtons()`呼び出しを追加
  - デフォルト言語が日本語の場合、初期読み込み時に日本語ボタンが正しくハイライトされるようになりました

### 設定管理
- `getDirectiveConfig()`関数を修正し、各リクエストで常に`directives.json`を再読み込み
- 指令URLを更新する際にNetlify Functionsサーバーを再起動する必要がなくなりました
- すべての指令（EMC、RED、LVD）で常に最新の設定が使用されます

## 📝 技術詳細

### 変更されたファイル

#### `netlify/functions/standards.js`
- ECページからExcelリンクを動的に抽出する`extractExcelLinkFromECPage()`関数を追加
  - HTMLページ解析とJSON APIレスポンスの両方を処理
  - `docsroom`ドキュメントエンドポイントをサポート
  - さまざまなHTMLパターンからExcelリンクを抽出
- `fetchStandardsFromExcel()`関数を強化：
  - ページURLと直接ダウンロードURLを検出
  - `docsroom` HTMLページへのリダイレクトを処理
  - ドキュメントIDからExcelダウンロードURLを構築
  - 必要に応じて実際のExcelバイナリを取得するためにセカンダリフェッチを実行
  - `Content-Disposition`ヘッダーからファイル名を抽出
- `getDirectiveConfig()`を修正し、常に指令データを再読み込み
- エラーハンドリングとロギングを改善

#### `static/api/directives.json`
- すべての指令の`excel_url`を直接ダウンロードリンクの代わりにページURLを使用するように更新：
  - **RED**: `https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/radio-equipment_en`
  - **EMC**: `https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/electromagnetic-compatibility-emc_en#:~:text=Summary%20list%20as%20xls%20file`
  - **LVD**: `https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/low-voltage-lvd_en`

#### `netlify/functions/scope-matcher.js`
- `isComprehensiveScopeMatch()`関数を更新し、スペース区切りの包括スコープパターンを処理
- 正規表現パターンを更新：`/\s*\/\s*-\d+/`で「 / -」と「/-」の両方の形式にマッチ
- パート番号抽出を更新し、「-17」と「 / -17」の両方のパターンを処理

#### `static/index.html`
- i18nサポート付きの通知ボックスHTML構造を追加
- 言語ボタンからハードコードされた`active`クラスを削除

#### `static/script.js`
- 通知ボックスのi18n翻訳を追加（英語と日本語）
- スコープマッチングノートを翻訳する`translateScopeNote()`関数を追加
- すべてのスコープマッチングノートタイプの翻訳キーを追加
- デフォルト言語を英語から日本語に変更（`currentLanguage = 'ja'`）
- `initializeApp()`関数に`updateLanguageButtons()`呼び出しを追加
- 言語切り替え機能を強化

#### `static/style.css`
- 警告色を使用した通知ボックスのスタイリングを追加
- 通知リンクのレスポンシブデザイン
- オレンジベースのカラースキームを更新（前回のリリースから）

## 🌐 国際化

### 新しい翻訳キー
- `standards.note_oj_update`: メイン通知テキスト
- `standards.note_red_link`: RED指令ラベル
- `standards.note_emc_link`: EMC指令ラベル
- `standards.note_lvd_link`: LVD指令ラベル
- `scope.note.comprehensive`: 包括スコープ適用メッセージ
- `scope.note.version_mismatch`: バージョン不一致メッセージ
- `scope.note.version_tolerant`: バージョン許容メッセージ
- `scope.note.scope_applied`: スコープ適用メッセージ
- `scope.note.prefix_mismatch`: プレフィックス不一致メッセージ

## 🔗 関連リンク

- RED指令: https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/radio-equipment_en
- EMC指令: https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/electromagnetic-compatibility-emc_en
- LVD指令: https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/low-voltage-lvd_en

## 📦 変更履歴

### 主要コミット
- `41d08f7`: 修正: directives.jsonを常に再読み込みし、EMC/LVD URLを更新
- `de57d73`: OJ更新通知と手動確認リンクを追加
- `45f08fb`: 修正: スペース区切りの包括スコープパターンに対するA2LAスコープマッチング
- `42f3bb7`: スコープマッチングノートの翻訳サポートを追加し、日本語をデフォルトに設定
- `4261213`: 日本語版リリースノートを追加し、コミット参照を更新
- `2cf9242`: すべての更新を2025年12月14日のリリースノートに統合

### フォローアップコミット
- `f58a5c2`: EMC/LVD修正の検証成功後にデバッグログを削除

## 🚀 デプロイメント注意事項

- データベースマイグレーションは不要
- 環境変数の変更は不要
- 設定変更は後方互換性があります
- すべての変更はデプロイ後すぐに有効になります
- ExcelファイルURLはデプロイ後の最初のフェッチで動的に抽出されます

## 👥 影響

- **ユーザー**: 
  - すべての指令（EMC、LVD、RED）のExcelファイルが最新のECページから自動的に取得されます
  - Fetch結果で正確なA2LA証明書スコープ情報を確認できます
  - EN 301 489-17などの規格に対する包括スコープマッチングが正しく機能します
  - スコープマッチングノートが言語設定に基づいて適切に翻訳されます
  - インターフェースはアクセシビリティ向上のためデフォルトで日本語になります
  - 言語ボタンが初期読み込み時にアクティブな言語を正しくハイライトします
  - 潜在的なOJ更新遅延について通知され、手動確認リンクが提供されます
- **開発者**: 
  - サーバーを再起動せずに指令URLを更新できます
  - 動的リンク抽出により保守負担が軽減されます
  - ECがファイル構造を変更しても、Excel URLを手動で更新する必要がありません
- **管理者**: ユーザーは潜在的なOJ更新遅延について通知され、手動確認リンクが提供されます

---

**リリース日**: 2025年12月14日  
**バージョン**: コミット `41d08f7`、`de57d73`、`45f08fb`、`42f3bb7`、`4261213`、`2cf9242`、`f58a5c2` に基づく
