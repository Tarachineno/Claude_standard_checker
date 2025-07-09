# EU Harmonized Standards Checker System 設計指示書

## 概要
EU指令（RE、EMC、LVD）のHarmonized standardsを自動的に取得し、ETSIポータルでの詳細情報検索、およびISO17025認証書からのスコープ抽出を可能にする3つのモジュールシステム。

## 1. OJ Checker モジュール

### 1.1 機能概要
- 各DirectiveのHarmonized standardsページから有効な規格番号とバージョンを抽出
- Amendmentを含む最新の規格情報を一覧表示
- 規格形式: EN 301 489-17 V3.3.1

### 1.2 対象Directive
1. **RE Directive (2014/53/EU)**
   - URL: https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/radio-equipment_en
   - 基準文書: Commission Implementing Decision (EU) 2022/2191
   - Amendments: 2023/10/03, 2023/11/27, 2025/01/28, 2025/05/14

2. **EMC Directive (2014/30/EU)**
   - URL: https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/electromagnetic-compatibility-emc_en
   - 基準文書: Commission Implementing Decision (EU) 2019/1326 他

3. **LVD Directive (2014/35/EU)**
   - URL: https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/low-voltage-lvd_en
   - 基準文書: Commission Implementing Decision (EU) 2023/2723
   - Amendments: 2024/04/19, 2024/10/30

### 1.3 技術仕様

#### 1.3.1 クラス設計
```python
class OJChecker:
    def __init__(self):
        self.directives = {
            'RE': {
                'url': 'https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/radio-equipment_en',
                'decision': 'Commission Implementing Decision (EU) 2022/2191'
            },
            'EMC': {
                'url': 'https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/electromagnetic-compatibility-emc_en',
                'decision': 'Commission Implementing Decision (EU) 2019/1326'
            },
            'LVD': {
                'url': 'https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/low-voltage-lvd_en',
                'decision': 'Commission Implementing Decision (EU) 2023/2723'
            }
        }
    
    def fetch_standards(self, directive: str) -> List[Standard]
    def parse_standard_document(self, html_content: str) -> List[Standard]
    def get_all_standards(self) -> Dict[str, List[Standard]]
    def format_standards_display(self, standards: List[Standard]) -> str
```

#### 1.3.2 データ構造
```python
@dataclass
class Standard:
    number: str          # 例: "EN 301 489-17"
    version: str         # 例: "V3.3.1"
    directive: str       # 例: "RE"
    title: str           # 規格タイトル
    status: str          # 有効/無効
    publication_date: str
    amendment_date: str  # 最新Amendment日付
```

#### 1.3.3 主要メソッド
- `fetch_standards(directive)`: 指定Directiveの規格を取得
- `parse_standard_document()`: HTMLからPDF/XLSリンクを解析し規格情報を抽出
- `get_all_standards()`: 全Directiveの規格を一括取得
- `format_standards_display()`: 規格を "EN 301 489-17 V3.3.1" 形式で表示

### 1.4 実装方針
- Webスクレイピング: BeautifulSoup + requests
- PDF/XLS解析: PyPDF2/pandas
- エラーハンドリング: ネットワーク障害、フォーマット変更対応
- キャッシュ機能: 24時間キャッシュで性能向上

## 2. ETSI Portal検索モジュール

### 2.1 機能概要
- OJ Checkerから取得した規格番号でETSIポータルを検索
- 規格の過去履歴とWGステータスを表示
- 検索結果を新しいブラウザウィンドウで表示

### 2.2 技術仕様

#### 2.2.1 クラス設計
```python
class ETSIPortalSearcher:
    def __init__(self):
        self.base_url = "https://portal.etsi.org/webapp/WorkProgram/Frame_WorkItemList.asp"
        self.search_params = {
            'SearchPage': 'TRUE',
            'qSORT': 'HIGHVERSION',
            'qINCLUDE_SUB_TB': 'True',
            'qETSI_ALL': 'TRUE',
            'qREPORT_TYPE': 'SUMMARY',
            'optDisplay': '10',
            'includeNonActiveTB': 'FALSE',
            'butSimple': '++Search++'
        }
    
    def search_standard(self, standard_number: str) -> str
    def generate_search_url(self, standard_number: str) -> str
    def open_search_result(self, url: str) -> None
    def batch_search(self, standards: List[Standard]) -> Dict[str, str]
```

#### 2.2.2 検索パラメータ
- `qETSI_NUMBER`: 規格番号（例: "301 489-17"）
- `qETSI_ALL`: TRUE（全バージョン検索）
- `qSORT`: HIGHVERSION（最新バージョン順）
- `qREPORT_TYPE`: SUMMARY（要約表示）

#### 2.2.3 主要メソッド
- `search_standard(standard_number)`: 単一規格の検索URL生成
- `generate_search_url()`: ETSIポータル検索URL構築
- `open_search_result()`: ブラウザで検索結果表示
- `batch_search()`: 複数規格の一括検索

### 2.3 URL生成ロジック
```python
def generate_search_url(self, standard_number: str) -> str:
    # "EN 301 489-17" → "301 489-17"
    etsi_number = standard_number.replace("EN ", "").replace("ETSI ", "")
    
    params = self.search_params.copy()
    params['qETSI_NUMBER'] = etsi_number
    
    return f"{self.base_url}?{urlencode(params)}"
```

## 3. ISO17025 スコープ抽出モジュール

### 3.1 機能概要
- ISO17025認証書PDFからスコープ（規格）情報を抽出
- 抽出した規格とOJ Checkerの結果を比較・統合
- 認証書の有効性チェック機能

### 3.2 対象データ構造
認証書PDFから抽出される情報：
- 証明書番号（例：7080.01）
- 有効期限（例：November 30, 2025）
- 認証機関（例：A2LA、JAB）
- 試験規格リスト（例：EN 301 489-17、IEC 61000-4-2）

### 3.3 技術仕様

#### 3.3.1 クラス設計
```python
class ISO17025ScopeExtractor:
    def __init__(self):
        self.supported_formats = ['pdf']
        self.standard_patterns = {
            'EN': r'EN\s+\d+\s+\d+(?:-\d+)*',
            'ETSI': r'ETSI\s+EN\s+\d+\s+\d+(?:-\d+)*',
            'IEC': r'IEC\s+\d+(?:-\d+)*',
            'CISPR': r'CISPR\s+\d+',
            'ANSI': r'ANSI\s+C\d+\.\d+:\d+',
            'FCC': r'CFR\s+47,\s+FCC\s+Part\s+\d+[A-Z]?',
            'ISO': r'ISO\s+\d+(?:-\d+)*'
        }
    
    def extract_from_pdf(self, pdf_path: str) -> AccreditationScope
    def parse_scope_text(self, text: str) -> List[TestStandard]
    def extract_certificate_info(self, text: str) -> CertificateInfo
    def validate_certificate(self, cert_info: CertificateInfo) -> bool
```

#### 3.3.2 データ構造
```python
@dataclass
class TestStandard:
    standard_number: str     # 例: "EN 301 489-17"
    version: str            # 例: "V3.3.1" (抽出可能な場合)
    category: str           # 例: "European Radio", "Immunity"
    description: str        # 規格の説明
    source: str            # 認証書のソース

@dataclass
class CertificateInfo:
    certificate_number: str
    valid_until: str
    organization: str
    accreditation_body: str  # A2LA、JAB等
    revision_date: str

@dataclass
class AccreditationScope:
    certificate_info: CertificateInfo
    test_standards: List[TestStandard]
    extraction_date: str
    pdf_source: str
```

#### 3.3.3 主要メソッド
- `extract_from_pdf()`: PDFファイルから認証スコープを抽出
- `parse_scope_text()`: テキストから規格情報を解析
- `extract_certificate_info()`: 証明書基本情報を抽出
- `validate_certificate()`: 証明書の有効性を確認

### 3.4 規格抽出ロジック
```python
def parse_scope_text(self, text: str) -> List[TestStandard]:
    standards = []
    
    # パターンマッチングで規格を抽出
    for category, pattern in self.standard_patterns.items():
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            standard = TestStandard(
                standard_number=match,
                category=self._determine_category(match, text),
                description=self._extract_description(match, text),
                source="ISO17025_Certificate"
            )
            standards.append(standard)
    
    return self._deduplicate_standards(standards)
```

## 4. 統合システム設計

### 4.1 メインアプリケーション
```python
class HarmonizedStandardsChecker:
    def __init__(self):
        self.oj_checker = OJChecker()
        self.etsi_searcher = ETSIPortalSearcher()
        self.iso17025_extractor = ISO17025ScopeExtractor()
    
    def run_full_check(self, directive: str = None) -> None
    def display_standards_with_search(self, standards: List[Standard]) -> None
    def compare_standards(self, oj_standards: List[Standard], 
                         iso_standards: List[TestStandard]) -> ComparisonResult
    def interactive_mode(self) -> None
```

### 4.2 統合機能設計

#### 4.2.1 規格比較機能
```python
@dataclass
class ComparisonResult:
    matched_standards: List[Tuple[Standard, TestStandard]]
    oj_only_standards: List[Standard]
    iso_only_standards: List[TestStandard]
    coverage_percentage: float
    
class StandardComparator:
    def compare_standards(self, oj_standards: List[Standard], 
                         iso_standards: List[TestStandard]) -> ComparisonResult
    def normalize_standard_number(self, standard: str) -> str
    def calculate_coverage(self, matched: int, total: int) -> float
```

#### 4.2.2 統合出力機能
```python
def generate_unified_report(self, comparison: ComparisonResult) -> str:
    report = f"""
    === Standards Comparison Report ===
    
    Total OJ Standards: {len(comparison.oj_only_standards) + len(comparison.matched_standards)}
    Total ISO17025 Standards: {len(comparison.iso_only_standards) + len(comparison.matched_standards)}
    Matched Standards: {len(comparison.matched_standards)}
    Coverage: {comparison.coverage_percentage:.1f}%
    
    === Matched Standards ===
    {self._format_matched_standards(comparison.matched_standards)}
    
    === OJ Only Standards ===
    {self._format_oj_standards(comparison.oj_only_standards)}
    
    === ISO17025 Only Standards ===
    {self._format_iso_standards(comparison.iso_only_standards)}
    """
    return report
```

### 4.3 使用方法

#### 4.3.1 単独モジュール使用
```python
# OJ Checkerのみ使用
checker = OJChecker()
re_standards = checker.fetch_standards('RE')
checker.format_standards_display(re_standards)

# ETSI Portal検索のみ使用
searcher = ETSIPortalSearcher()
search_url = searcher.generate_search_url("EN 301 489-17")
searcher.open_search_result(search_url)

# ISO17025スコープ抽出のみ使用
extractor = ISO17025ScopeExtractor()
scope = extractor.extract_from_pdf("/path/to/certificate.pdf")
print(scope.test_standards)
```

#### 4.3.2 統合使用
```python
# 完全統合使用
app = HarmonizedStandardsChecker()
app.run_full_check('RE')  # RE Directiveの規格取得＋ETSI検索

# ISO17025証明書との比較
iso_scope = app.iso17025_extractor.extract_from_pdf("/path/to/cert.pdf")
oj_standards = app.oj_checker.get_all_standards()
comparison = app.compare_standards(oj_standards['RE'], iso_scope.test_standards)
print(app.generate_unified_report(comparison))

app.interactive_mode()    # 対話モード
```

### 4.4 出力形式
```
=== RE Directive Harmonized Standards ===
EN 301 489-17 V3.3.1 - Generic immunity and emission standard
EN 301 489-1 V2.2.3 - Common technical requirements
EN 301 489-3 V2.1.1 - Short Range Devices (SRD)
...

=== ISO17025 Certificate Scope ===
Certificate: 7080.01 (Valid until: November 30, 2025)
Organization: SGS JAPAN INC.
Accreditation Body: A2LA

Extracted Standards:
- EN 301 489-17 (European Radio)
- EN 301 489-1 (European Radio)
- IEC 61000-4-2 (Immunity - ESD)
- CISPR 32 (Emissions for ports)
...

=== Standards Comparison Report ===
Total OJ Standards: 45
Total ISO17025 Standards: 38
Matched Standards: 22
Coverage: 57.9%

=== Matched Standards ===
✓ EN 301 489-17 (OJ: V3.3.1 | ISO17025: European Radio)
✓ EN 301 489-1 (OJ: V2.2.3 | ISO17025: European Radio)
...

[Search] 規格番号を選択してETSI Portal検索: 301 489-17
-> https://portal.etsi.org/webapp/WorkProgram/Frame_WorkItemList.asp?SearchPage=TRUE&qSORT=HIGHVERSION&qINCLUDE_SUB_TB=True&qETSI_STANDARD_TYPE=&qETSI_NUMBER=301+489-17&qETSI_ALL=TRUE...
```

## 5. 実装優先度

### Phase 1: 基本機能
1. OJ Checker基本実装
2. ETSI Portal検索URL生成
3. ISO17025スコープ抽出基本実装
4. 単独モジュール動作確認

### Phase 2: 統合機能
1. 規格比較機能実装
2. 統合アプリケーション実装
3. エラーハンドリング強化
4. ユーザビリティ向上

### Phase 3: 拡張機能
1. キャッシュ機能実装
2. 結果エクスポート機能
3. 自動更新チェック機能
4. 複数認証書の一括処理

## 6. 技術的考慮事項

### 6.1 PDF処理
- 複数のPDFライブラリ対応（pdfplumber、PyPDF2、pdfminer）
- OCR機能の検討（画像ベースPDF対応）
- 認証書フォーマットの多様性への対応

### 6.2 規格マッチング
- 規格番号の正規化処理（スペース、ハイフン、コロンの統一）
- バージョン情報の取り扱い
- 部分一致の許容レベル設定

### 6.3 データ整合性
- 有効期限チェック
- 重複規格の除去
- 無効な規格番号の検出

## 7. 注意事項
- 2025年4月以降、要約リストは保守作業により更新されない可能性
- PDF/XLS形式の変更に対応できるパーサー設計
- ETSIポータルの利用規約遵守
- レート制限による検索間隔調整
- 認証書PDFの機密性保護（ログ出力時の注意）
- 複数認証機関（A2LA、JAB、ILAC等）のフォーマット差異への対応