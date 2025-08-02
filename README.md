# EU Harmonized Standards Checker

A modern web application for checking EU harmonized standards compliance and comparing with ISO17025 certificates. Built with pure JavaScript and deployed on Netlify.

---
**🌟 Pure JavaScript Web Application (2025)**

- ✅ **Zero-dependency Frontend**: Pure JavaScript, HTML5, CSS3
- ✅ **Netlify Functions Backend**: Node.js serverless functions
- ✅ **Real-time OJ Standards**: Direct EUR-Lex integration
- ✅ **Responsive Design**: Mobile-first, professional interface
- ✅ **No Python Dependencies**: Fully web-native implementation
- ✅ **Instant Deployment**: Automatic CI/CD with Netlify

**Latest Updates:**
- Complete rewrite as pure JavaScript web application
- Netlify Functions for serverless backend
- Real-time EUR-Lex Official Journal integration
- Modern responsive user interface
- Cross-platform compatibility
---

## 機能

### 1. OJ Checker モジュール
（実装済み・動作確認済み）
- Official Journal (OJ)からのharmonized standards自動取得
- RED、EMC、LVDディレクティブ対応
- キャッシュ機能による高速化
- 外部JSON設定による柔軟なOJリンク管理

### 2. ETSI Portal検索モジュール
（実装済み・動作確認済み）
- ETSI Portal APIを使用した規格詳細検索
- 規格番号による自動検索とブラウザ表示
- 一括検索機能

### 3. ISO17025スコープ抽出モジュール
（実装済み・動作確認済み）
- PDF認証書からの規格自動抽出
- 証明書情報（番号、有効期限、認証機関）の抽出
- 複数の規格パターン対応

### 4. 統合比較機能
（実装済み・動作確認済み）
- OJ CheckerとISO17025の結果を比較
- カバレッジ計算と詳細レポート生成
- 規格マッチング精度の向上

### 5. 外部設定システム（NEW）
（実装済み）
- `oj_config.json`による設定外部化
- 動的なOJリンク追加・更新機能
- モバイルアプリ対応の分離された設定
- 設定検証とエラーハンドリング

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
- `oj_config.json`設定ファイル（自動生成済み）

## 使用方法

### コマンドライン使用法

```bash
# 対話式モード
python main.py interactive

# 指定DirectiveのOJ規格を取得（REDに変更）
python main.py check RED

# 全DirectiveのOJ規格を取得
python main.py check

# ISO17025証明書との比較
python main.py compare data/certificate.pdf RED

# 規格検索
python main.py search "301 489"

# デバッグモード
python main.py debug RED
```

### 単独モジュール使用例

```python
# OJ Checkerのみ使用
from oj_checker import OJChecker

checker = OJChecker()
result = checker.fetch_standards('RED')  # REDに変更
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
app.run_full_check('RED')  # REDに変更

# ISO17025証明書との比較
app.compare_with_iso17025("data/certificate.pdf", "RED")

# 対話式モード
app.interactive_mode()
```

### 設定管理の使用例（NEW）

```python
from config_manager import ConfigurationManager

config_mgr = ConfigurationManager()

# 新しいamendment URLを追加
config_mgr.add_amendment_to_json(
    "RED", 
    "https://eur-lex.europa.eu/new-amendment-2025", 
    "2025-12-01",
    "New amendment description"
)

# 新しいディレクティブを追加
config_mgr.add_new_directive_to_json(
    directive_code="NEWDIR",
    name="New Directive",
    directive_number="2025/XX/EU",
    main_url="https://eur-lex.europa.eu/main-url",
    ec_webpage="https://single-market-economy.ec.europa.eu/new-directive",
    decision="Commission Implementing Decision (EU) 2025/XXXX"
)

# 設定状況の確認
config_mgr.print_configuration_summary()
```

## 出力例

### OJ Checker出力
```
=== Radio Equipment Directive (RED) ===
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

Radio Equipment Directive (RED):
  Coverage: 57.9%
  Matched: 22
  OJ Only: 23

=== Matched Standards ===
✓ EN 301 489-17 V3.3.1 ↔ EN 301 489-17 (European Radio)
✓ EN 301 489-1 V2.2.3 ↔ EN 301 489-1 (European Radio)
...
```

## 設定

### 設定ファイル構成（更新）

#### oj_config.json（NEW）
外部JSON設定ファイル：
- 各ディレクティブのOJリンク情報
- Amendment URLの動的管理
- モバイルアプリ対応の分離された設定
- メタデータとAPI互換性情報

#### config.py
システム設定：
- ETSI Portal設定
- 規格抽出パターン
- キャッシュ・HTTP・ログ設定
- 外部JSON設定の読み込み機能

### OJリンクの追加方法

**方法1: 設定ファイル直接編集**
```json
{
  "directives": {
    "RED": {
      "oj_links": {
        "amendments": [
          {
            "url": "https://eur-lex.europa.eu/new-amendment",
            "date": "2025-12-01",
            "description": "New amendment description"
          }
        ]
      }
    }
  }
}
```

**方法2: プログラムで追加**
```python
from config_manager import ConfigurationManager
mgr = ConfigurationManager()
mgr.add_amendment_to_json("RED", "https://eur-lex.europa.eu/new-url", "2025-12-01")
```

### 設定検証
```bash
python3 oj_config_validator.py
```

### キャッシュ機能
- 24時間のキャッシュで性能向上
- `cache/`フォルダに保存
- 自動期限切れ管理

## ログ機能
- `standards_checker.log`に詳細ログを出力
- `debug_standards.log`にデバッグ情報を出力
- エラー追跡とデバッグ情報

## 注意事項

- 2025年4月以降、要約リストは保守作業により更新されない可能性があります
- ETSIポータルの利用規約を遵守してください
- 認証書PDFの機密性保護にご注意ください
- 大量のリクエストを行う場合は適切な間隔を設けてください
- REディレクティブコードはREDに変更されています

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
├── config.py                 # 設定ファイル（更新）
├── config_manager.py         # 設定管理モジュール（NEW）
├── oj_config.json            # 外部JSON設定ファイル（NEW）
├── oj_config_validator.py    # 設定検証モジュール（NEW）
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

4. **設定ファイルエラー（NEW）**
   - `oj_config_validator.py`で設定を検証
   - JSON形式とURL形式の確認

### ログの確認
```bash
tail -f standards_checker.log
tail -f debug_standards.log
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

### 新しいDirectiveの追加（更新）
`oj_config.json`に新しいディレクティブを追加：

```json
{
  "directives": {
    "NEW_DIRECTIVE": {
      "name": "New Directive Name",
      "directive_number": "2025/XX/EU",
      "decision": "Commission Implementing Decision (EU) 2025/XXXX",
      "ec_webpage": "https://example.com/new-directive",
      "description": "New directive description",
      "oj_links": {
        "main": "https://eur-lex.europa.eu/main-url",
        "amendments": []
      }
    }
  }
}
```

またはプログラムで追加：

```python
from config_manager import ConfigurationManager
mgr = ConfigurationManager()
mgr.add_new_directive_to_json(
    directive_code="NEW_DIRECTIVE",
    name="New Directive Name",
    directive_number="2025/XX/EU",
    main_url="https://eur-lex.europa.eu/main-url",
    ec_webpage="https://example.com/new-directive",
    decision="Commission Implementing Decision (EU) 2025/XXXX"
)
```

### モバイルアプリ開発者向け
- `oj_config.json`はプラットフォーム非依存
- JSON形式でAPIとの互換性確保
- 設定の動的更新に対応
- バリデーション機能を活用

## API互換性

このシステムは以下のプラットフォームでの使用を想定しています：
- ✅ デスクトップアプリケーション
- ✅ Webサービス
- ✅ モバイルアプリケーション

## ライセンス
このプロジェクトはMITライセンスの下で公開されています。

## サポート
問題や提案がある場合は、GitHubのIssueまたはプルリクエストを作成してください。