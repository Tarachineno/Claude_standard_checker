# EU Harmonized Standards Checker - Package Distribution Version

**簡素化されたパッケージ版：インストール制限のあるPC環境向け**

このパッケージ版は、インストール制限のある企業環境やスタンドアローンPCでの利用を想定して、ISO17025比較機能を除いた基本機能のみを提供します。

## 📋 提供機能

✅ **利用可能な機能:**
- OJ Standards取得 (RED, EMC, LVD)
- ETSI Portal検索
- ISO17025証明書からの規格抽出
- 外部JSON設定管理

❌ **パッケージ版では利用不可:**
- OJとISO17025の規格比較
- 詳細比較レポート生成

## 🚀 クイックスタート

### 1. パッケージの配置
全ファイルを同じフォルダに配置してください：

```
eu_standards_checker/
├── run_checker.py          # メインランチャー
├── main.py                 # アプリケーション本体
├── oj_checker.py           # OJ規格取得
├── etsi_searcher.py        # ETSI検索
├── iso17025_extractor.py   # ISO17025抽出
├── config.py               # 設定管理
├── oj_config.json          # 外部設定ファイル
├── config_manager.py       # 設定管理ツール
├── oj_config_validator.py  # 設定検証
├── data_models.py          # データモデル
├── utils.py                # ユーティリティ
├── requirements.txt        # 依存パッケージリスト
├── install_minimal.py      # 最小インストールスクリプト
└── README_PACKAGE.md       # このファイル
```

### 2. 依存関係のインストール

**🔒 インストール制限のある環境（推奨）:**
```bash
# 自動最小インストール（推奨）
python install_minimal.py

# または手動で必須パッケージのみ
pip install requests beautifulsoup4 lxml urllib3 PyPDF2 pdfplumber pandas
```

**🔓 制限のない環境:**
```bash
pip install -r requirements.txt
```

**📦 インストール後の確認:**
```bash
python run_checker.py  # 依存関係を自動チェック
```

### 3. 実行方法

**推奨：スタンドアローンランチャー**
```bash
python run_checker.py
```

**直接実行**
```bash
# 対話式モード
python main.py interactive

# OJ規格取得
python main.py check RED

# 規格検索
python main.py search "EN 301 489"

# デバッグモード
python main.py debug RED
```

## 💻 使用例

### 対話式モード
```bash
python run_checker.py
```
メニューから選択：
- 1: OJ規格取得
- 2: ETSI検索  
- 3: ISO17025証明書抽出

### コマンドライン使用
```bash
# RED指令の全規格を取得
python main.py check RED

# 特定規格を検索
python main.py search "301 489"

# ISO17025証明書から規格抽出
python main.py interactive
# -> 3を選択してPDFパスを入力
```

## ⚙️ 設定管理

### OJリンクの追加
新しいOJリンクは `oj_config.json` を編集して追加：

```json
{
  "directives": {
    "RED": {
      "oj_links": {
        "amendments": [
          {
            "url": "https://eur-lex.europa.eu/new-amendment",
            "date": "2025-12-01",
            "description": "新しいamendment"
          }
        ]
      }
    }
  }
}
```

### 設定検証
```bash
python oj_config_validator.py
```

## 🔧 トラブルシューティング

### よくある問題

1. **依存パッケージエラー**
   ```bash
   # インストール制限環境の場合
   python install_minimal.py
   
   # 通常環境の場合
   pip install -r requirements.txt
   ```

2. **PDFが読み込めない**
   - PDF形式を確認
   - ファイルパスに日本語が含まれていないか確認

3. **ネットワークエラー**
   - プロキシ設定を確認
   - ファイアウォール設定を確認

4. **設定ファイルエラー**
   ```bash
   python oj_config_validator.py
   ```

### ログの確認
- 一般ログ: `standards_checker.log`
- デバッグログ: `debug_standards.log`

## 📦 パッケージ内容

### 主要モジュール
- `run_checker.py`: スタンドアローンランチャー
- `main.py`: メインアプリケーション
- `oj_checker.py`: Official Journal規格取得
- `etsi_searcher.py`: ETSI Portal検索
- `iso17025_extractor.py`: ISO17025証明書解析

### 設定・データファイル
- `oj_config.json`: 外部設定ファイル
- `config.py`: システム設定
- `data_models.py`: データ構造定義

### ユーティリティ
- `config_manager.py`: 設定管理ツール
- `oj_config_validator.py`: 設定検証ツール
- `utils.py`: 共通ユーティリティ

## 🔄 フル機能版への移行

比較機能が必要な場合は、開発版をご利用ください：
- GitHub: https://github.com/Tarachineno/Claude_standard_checker
- ブランチ: `master` (フル機能版)

## ⚠️ 注意事項

- このパッケージ版では比較機能は利用できません
- インターネット接続が必要です
- EU公式サイトの利用規約を遵守してください
- 大量リクエスト時は適切な間隔を設けてください

## 📞 サポート

- 問題報告: GitHub Issues
- 機能要求: Pull Request
- ドキュメント: README.md (フル版)

---
**EU Harmonized Standards Checker - Package Version**  
*Simplified for enterprise and standalone environments*