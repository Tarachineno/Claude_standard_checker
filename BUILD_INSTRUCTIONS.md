# EU Harmonized Standards Checker - Build Instructions

PyInstallerを使用してスタンドアロン実行ファイルを作成する手順です。

## 📋 前提条件

### 開発環境の準備
```bash
# Python 3.7以上が必要
python --version

# 仮想環境の作成（推奨）
python -m venv build_env
source build_env/bin/activate  # Linux/Mac
# または
build_env\Scripts\activate     # Windows
```

### 依存関係のインストール
```bash
# 全ての依存関係をインストール
pip install -r requirements.txt

# PyInstallerをインストール
pip install pyinstaller
```

## 🔨 ビルド手順

### 方法1: 自動ビルドスクリプト（推奨）
```bash
python build_executable.py
```

このスクリプトが以下を自動実行します：
1. ✅ PyInstaller存在確認
2. ✅ 依存関係確認
3. 🧹 前回ビルドのクリーンアップ
4. 🔨 実行ファイル作成
5. 🧪 実行ファイルテスト
6. 📦 配布パッケージ作成

### 方法2: 手動ビルド
```bash
# クリーンビルド
pyinstaller --clean --noconfirm eu_standards_checker.spec

# または初回ビルド用
pyinstaller --onefile --name="eu_standards_checker" run_checker.py
```

## 📂 ビルド結果

ビルド成功後、以下のファイルが作成されます：

```
dist/
├── eu_standards_checker(.exe)  # メイン実行ファイル
├── README_PACKAGE.md           # パッケージドキュメント
├── oj_config.json              # 設定ファイル
├── requirements.txt            # 依存関係リスト
└── USAGE.txt                   # 使用方法
```

## 🎯 実行ファイルの特徴

- **サイズ**: 約50-100MB
- **依存関係**: Python環境不要、全パッケージ同梱
- **対応OS**: Windows (.exe), Linux, macOS
- **起動時間**: 初回5-10秒、2回目以降1-3秒

## 🧪 テスト方法

### 基本動作テスト
```bash
# ヘルプ表示
./dist/eu_standards_checker

# 対話モード
./dist/eu_standards_checker interactive

# 規格取得テスト  
./dist/eu_standards_checker check RED
```

### 配布前テスト項目
- [ ] 実行ファイルが起動する
- [ ] 対話モードが動作する
- [ ] OJ規格取得が成功する
- [ ] ETSI検索が動作する
- [ ] ISO17025抽出が動作する
- [ ] 設定ファイルが読み込める

## 📦 配布準備

### 1. ファイル準備
```bash
# 配布用フォルダ作成
mkdir eu_standards_checker_v1.0

# 必要ファイルをコピー
cp dist/eu_standards_checker* eu_standards_checker_v1.0/
cp dist/*.md eu_standards_checker_v1.0/
cp dist/*.json eu_standards_checker_v1.0/
cp dist/*.txt eu_standards_checker_v1.0/
```

### 2. 圧縮
```bash
# ZIP形式で圧縮
zip -r eu_standards_checker_v1.0.zip eu_standards_checker_v1.0/

# または tar.gz形式
tar -czf eu_standards_checker_v1.0.tar.gz eu_standards_checker_v1.0/
```

## ⚠️ 注意事項

### ビルド環境
- ビルドしたOSでのみ実行可能（クロスプラットフォーム不可）
- Windowsで.exe、Linux/macOSでバイナリを作成
- 32bit/64bitはビルド環境に依存

### サイズ最適化
- 不要なパッケージを`excludes`に追加
- UPX圧縮を有効化（`upx=True`）
- 必要最小限のモジュールのみ含める

### セキュリティ
- 実行ファイルはウイルススキャナに検知される場合がある
- 社内配布時は事前にIT部門に確認を推奨

## 🐛 トラブルシューティング

### よくある問題

1. **ModuleNotFoundError**
   ```bash
   # 隠しインポートを追加
   pyinstaller --hidden-import=missing_module run_checker.py
   ```

2. **ファイルサイズが大きすぎる**
   ```python
   # spec ファイルでexcludesを追加
   excludes=['matplotlib', 'scipy', 'numpy']
   ```

3. **起動が遅い**
   - 初回起動は展開処理のため遅い（正常）
   - `--onedir`オプションで改善可能（複数ファイル配布）

4. **設定ファイルが見つからない**
   ```python
   # バンドル環境での相対パス処理を確認
   if getattr(sys, 'frozen', False):
       config_path = os.path.join(sys._MEIPASS, 'oj_config.json')
   ```

### デバッグモード
```bash
# デバッグ情報付きでビルド
pyinstaller --debug=all eu_standards_checker.spec
```

## 📞 サポート

- ビルドエラー: specファイルの`hiddenimports`を確認
- 実行エラー: `--debug=all`でデバッグ情報を取得
- パフォーマンス: `--onedir`オプションを検討

---
**ビルド完了後は `dist/` フォルダ内の実行ファイルが配布可能です！**