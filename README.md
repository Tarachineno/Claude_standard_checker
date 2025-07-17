# EU Harmonized Standards Checker System

EU指令（RE、EMC、LVD）のHarmonized standardsを自動取得し、ETSIポータルでの詳細検索、およびISO17025認証書からのスコープ抽出・比較を行うシステムです。

---
**進捗状況（2025/07/17時点）**

- 1. OJ Checker：OK
- 2. ETSI Portal検索：OK
- 3. ISO17025スコープ抽出：OK
- 4. 統合比較機能：作成中
- 5. 詳細比較レポート・カバレッジ計算：作成中

それ以外の機能は正常動作確認済みです。
---

## 機能

### 1. OJ Checker モジュール
（実装済み・動作確認済み）

（実装済み・動作確認済み）
- 一括検索機能
（実装済み・動作確認済み）
- 証明書情報（番号、有効期限、認証機関）の抽出
（作成中）
- OJ CheckerとISO17025の結果を比較
（作成中）
- 詳細な比較レポート生成

## セットアップ

### 1. 依存関係のインストール

```bash
# 仮想環境を作成（推奨）
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# または
venv\\Scripts\\activate  # Windows

# 必要なパッケージをインストール
pip install -r requirements.txt
```

### 2. 必要なファイル
- `data/`フォルダにISO17025認証書PDFファイルを配置

## 使用方法

### コマンドライン使用法

```bash
# 対話式モード
python main.py interactive

# 指定DirectiveのOJ規格を取得
python main.py check RE

# 全DirectiveのOJ規格を取得
python main.py check

# ISO17025証明書との比較
python main.py compare data/certificate.pdf RE

# 規格検索
python main.py search "301 489"
```

### 単独モジュール使用例

```python
# OJ Checkerのみ使用
from oj_checker import OJChecker

checker = OJChecker()
result = checker.fetch_standards('RE')
if result.success:
    standards = result.data
    print(checker.format_standards_display(standards))

# ETSI Portal検索のみ使用
from etsi_searcher import ETSIPortalSearcher

searcher = ETSIPortalSearcher()
result = searcher.search_and_open("EN 301 489-17")

# ISO17025スコープ抽出のみ使用
from iso17025_extractor import ISO17025ScopeExtractor

extractor = ISO17025ScopeExtractor()
result = extractor.extract_from_pdf("data/certificate.pdf")
if result.success:
    scope = result.data
    print(f"Found {len(scope.test_standards)} standards")
```

### 統合使用例

```python
from main import HarmonizedStandardsChecker

app = HarmonizedStandardsChecker()

# 完全統合使用
app.run_full_check('RE')

# ISO17025証明書との比較
app.compare_with_iso17025("data/certificate.pdf", "RE")

# 対話式モード
app.interactive_mode()
```

## 出力例

### OJ Checker出力
```
=== Radio Equipment Directive (RE) ===
Found 45 standards:
EN 301 489-17 V3.3.1 - Generic immunity and emission standard
EN 301 489-1 V2.2.3 - Common technical requirements
EN 301 489-3 V2.1.1 - Short Range Devices (SRD)
...
```

### 比較レポート出力
```
=== Standards Comparison Report ===
Certificate: 7080.01
Organization: SGS JAPAN INC.
Total ISO17025 Standards: 38

Radio Equipment Directive (RE):
  Coverage: 57.9%
  Matched: 22
  OJ Only: 23

=== Matched Standards ===
✓ EN 301 489-17 V3.3.1 ↔ EN 301 489-17 (European Radio)
✓ EN 301 489-1 V2.2.3 ↔ EN 301 489-1 (European Radio)
...
```

## 設定

### config.py
- Directive URLs
- ETSI Portal設定
- 規格抽出パターン
- キャッシュ設定

### キャッシュ機能
- 24時間のキャッシュで性能向上
- `cache/`フォルダに保存
- 自動期限切れ管理

## ログ機能
- `standards_checker.log`に詳細ログを出力
- エラー追跡とデバッグ情報

## 注意事項

- 2025年4月以降、要約リストは保守作業により更新されない可能性があります
- ETSIポータルの利用規約を遵守してください
- 認証書PDFの機密性保護にご注意ください
- 大量のリクエストを行う場合は適切な間隔を設けてください

## ファイル構成

```
Claude_standard_checker/
├── main.py                    # メインアプリケーション
├── oj_checker.py             # OJ Checkerモジュール
├── etsi_searcher.py          # ETSI Portal検索モジュール
├── iso17025_extractor.py     # ISO17025スコープ抽出モジュール
├── comparator.py             # 規格比較モジュール
├── data_models.py            # データモデル定義
├── utils.py                  # ユーティリティ関数
├── config.py                 # 設定ファイル
├── requirements.txt          # 依存パッケージ
├── README.md                 # このファイル
├── design_specification.md   # 設計指示書
├── data/                     # データフォルダ
│   ├── 7080-01.pdf          # サンプル認証書
│   └── JAB Accreditation... # サンプル認証書
└── cache/                    # キャッシュフォルダ（自動生成）
```

## トラブルシューティング

### よくある問題

1. **PDFから文字が抽出できない**
   - 画像ベースのPDFの場合、OCR機能の検討が必要
   - 複数のPDFライブラリを順次試行

2. **ネットワークエラー**
   - プロキシ設定の確認
   - リトライ機能が自動実行される

3. **規格マッチングの精度**
   - 類似度閾値の調整（`comparator.py`）
   - 規格番号の正規化ルールの調整

### ログの確認
```bash
tail -f standards_checker.log
```

## 開発者向け情報

### 新しい規格パターンの追加
`config.py`の`STANDARD_PATTERNS`に新しいパターンを追加：

```python
STANDARD_PATTERNS = {
    'YOUR_STANDARD': r'YOUR_PATTERN_HERE',
    # 既存のパターン...
}
```

### 新しいDirectiveの追加
`config.py`の`DIRECTIVE_URLS`と`DIRECTIVE_INFO`に追加：

```python
DIRECTIVE_URLS = {
    'NEW_DIRECTIVE': 'https://example.com/new-directive',
    # 既存のURL...
}
```

## ライセンス
このプロジェクトはMITライセンスの下で公開されています。

## サポート
問題や提案がある場合は、GitHubのIssueまたはプルリクエストを作成してください。