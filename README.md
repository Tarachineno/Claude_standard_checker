# Lab Scope Checker

A web application for comparing EU harmonised standards with ISO/IEC 17025 laboratory scopes. Built with pure JavaScript. **Current deployment target: Cloudflare Workers (branch `cloudflare-workers`, see below).** The Netlify edition lives on branch `netlify-pure-webapp`.

---

## ☁️ Cloudflare Workers 版（v3.0 / ブランチ `cloudflare-workers`）

Netlify 版（ブランチ `netlify-pure-webapp`）を **Cloudflare Workers + Static Assets + D1 + KV** に移設したものです。
画面・API の互換性は維持しつつ、営業向けの **クイック判定** タブと、認定スコープの **D1 データベース化** を追加しています。

### 構成

| 役割 | Netlify 版 | Cloudflare 版 |
|---|---|---|
| 静的ファイル（`static/`） | Netlify Hosting | Workers Static Assets（`wrangler.jsonc` の `assets`） |
| API（旧 `netlify/functions/*`） | Netlify Functions（Lambda 形式） | `src/index.js`（[Hono](https://hono.dev)）— `/api/*`。旧パス `/.netlify/functions/*` も互換で残してあります |
| EC 公式 Excel のキャッシュ | Lambda のローカルディスク | **KV**（`CACHE`）。未設定でも同梱の `static/data/*.xlsx` で動作 |
| JAB / A2LA 認定スコープ | MD を毎回パース | **D1**（`DB`）。正本は今まで通り `static/data/*-scopes.md`、`npm run db:seed` で投入。未シードなら MD にフォールバック |
| アクセス制御 | なし | **Cloudflare Access**（ダッシュボード側で設定。コード変更不要） |

```
src/
├── index.js               Worker エントリ（ルーティング / CORS / 404）
├── lib/
│   ├── http.js            レスポンス・静的アセット読み込みのヘルパー
│   ├── md.js              スコープ MD パーサ（Worker と seed スクリプトで共用）
│   ├── matcher.js         規格番号の正規化・照合（旧 scope-matcher / scope-search の純粋関数）
│   ├── excel.js           EC Excel の解析
│   ├── standards.js       整合規格リストの取得（KV → EC → 同梱 Excel → fallback JSON）
│   └── scopes.js          認定スコープの取得（D1 → MD）
└── routes/
    ├── standards.js       /directives /standards /download-excel /search /compare /batch-compare
    ├── scopes.js          /certificate-data /parse-md-scopes /scope-matcher /scope-search /scopes/status /certificate
    ├── quick-check.js     /quick-check（営業向けクイック判定）
    └── meta.js            /me /health
migrations/0001_init.sql   D1 スキーマ
scripts/seed-from-md.mjs   MD → seed/scopes.sql 生成（冪等）
test/                      node --test（ロジック + API 結合テスト。ブラウザ不要）
```

### 初回セットアップ（本番）

前提: Cloudflare アカウント、Node.js 20 以上。

```bash
git checkout cloudflare-workers
npm install
npx wrangler login                                   # ブラウザで Cloudflare にログイン

# 1) D1 と KV を作る（出力される id を wrangler.jsonc に貼る）
npx wrangler d1 create standards-checker             # → d1_databases[0].database_id
npx wrangler kv namespace create CACHE               # → kv_namespaces[0].id

# 2) スキーマ適用 → MD からスコープを投入
npm run db:migrate
npm run db:seed

# 3) デプロイ
npm run deploy                                       # → https://lab-scope-checker.seidaku.workers.dev
```

独自ドメイン（例 `standards.seidaku.com`）を付ける場合は、ダッシュボードの **Workers & Pages → eu-standards-checker → Settings → Domains & Routes → Add → Custom domain**。DNS は自動で入ります。

### Cloudflare Access（SGS メール限定にする）

1. ダッシュボード **Zero Trust → Access → Applications → Add an application → Self-hosted**
2. Application domain に Worker のホスト名（workers.dev または独自ドメイン）を入れる
3. Policy: *Allow* / Include → **Emails ending in** `@sgs.com`
4. Identity provider は最初は **One-time PIN** で十分（メールに届く PIN でログイン）。後から Google / Azure AD に差し替え可能
5. 保存すると、その時点から未ログインのアクセスは全部ログイン画面に飛びます。API も同じホストなので一緒に守られます

ログイン済みユーザーのメールは `Cf-Access-Authenticated-User-Email` ヘッダで Worker に届き、画面右上に表示されます（`/api/me`）。
Access の無料枠は 50 ユーザーまで。

### ローカル開発

```bash
npm run setup:local      # ローカル D1 にスキーマ適用 + シード（初回だけ）
npm run dev              # http://localhost:8787  （静的ファイル + API + ローカル D1/KV）
npm test                 # ロジックと API の自動テスト（22 件）
```

`wrangler.jsonc` の `database_id` / `id` がプレースホルダのままでもローカル開発は動きます。

### 認定スコープ（JAB / A2LA）の更新手順

今まで通り **MD を編集するだけ** です。D1 には「投入」で反映します。

```bash
# 1) static/data/jab-scopes.md または a2la-scopes.md を編集（書式は下の「MD File Format Rules」参照）
npm test                 # パーサが通ることを確認
# 2) 投入（内容が変わっていれば新しい改訂として登録され、古い改訂は履歴として残る）
npm run db:seed
# 3) 静的ファイル（MD 本体）も更新されるのでデプロイ
npm run deploy
```

投入状況は `GET /api/scopes/status` で確認できます（現在の改訂・件数・投入日時）。

### クイック判定（営業向け）

トップの **クイック判定** タブに規格番号を貼ると、1 件ずつ次を返します。

| 列 | 内容 |
|---|---|
| 総合 | **OK** = 認定範囲内（完全一致 / 年版のみ違い / 包括表記に含まれる / 表記違いのみ）、**要確認** = 認定書に別の年版で載っている、**NG** = JAB・A2LA どちらにも無い |
| JAB / A2LA | 一致したスコープ項目、施設、注記。「他」は同じ規格が別施設・別項目にもある場合 |
| OJ | EU 官報の整合規格リスト（EMC / RED / LVD）での掲載状況（掲載あり / 取下げ済 / 掲載なし）と年版 |

結果は「表をコピー」（Excel に貼れる TSV）、CSV、印刷に出せます。API は `POST /api/quick-check` `{ "text": "EN 55032:2015\nEN 300 328 V2.2.2" }`。

### 旧版からの変更点（動作が変わる箇所）

- 照合の改善（`src/lib/matcher.js`）
  - `EN 55032:2015` と `EN 55032` の比較が「表記違い(EN :/EN)」ではなく **「バージョン包括(2015)」** になりました（年版の区切り記号が残るバグを修正）
  - 同じ番号が複数のスコープ項目に当たる場合、**最も良い一致** を返します（旧: 最初に当たった項目。A2LA で `IEC 61000-4-2` が `EN 61000-4-2` より前にあるため EN 規格が「表記違い」になっていた）
  - スコープ検索で空白入りの範囲表記（`EN 302 065-1 / -2 / -3 / -4`）や包括表記の部番（`489-52`）がヒットするようになりました
  - 大小文字・連続空白の違いは無視します
- `/api/standards` のレスポンスに `source`（`ec` / `kv` / `bundled` / `fallback`）、`last_checked`、`last_updated`、`last_added` を追加。EC への更新確認は既定 6 時間に 1 回（`STANDARDS_RECHECK_SECONDS`）
- `/api/certificate-data` に `total_standards`、`source`（`d1` / `md`）、`imported_at` を追加
- Tesseract の学習データ（`*.traineddata`、8MB）と Netlify 用ファイルはこのブランチから削除（どこからも参照されていませんでした）

---
**🌟 Pure JavaScript Web Application (2025)**

- ✅ **Zero-dependency Frontend**: Pure JavaScript, HTML5, CSS3
- ✅ **Netlify Functions Backend**: Node.js serverless functions  
- ✅ **Excel File Integration**: Direct access to official EC Excel files
- ✅ **Multi-Directive Support**: RED, EMC, and LVD directives
- ✅ **ETSI Portal Integration**: Direct redirect to official ETSI standards portal
- ✅ **Download Functionality**: Secondary use of official Excel files
- ✅ **Responsive Design**: Mobile-first, professional interface
- ✅ **Real-time Processing**: Dynamic Excel parsing with comprehensive data extraction
- ✅ **Instant Deployment**: Automatic CI/CD with Netlify

**Latest Updates (August 2025):**
- 🌐 **Complete Bilingual Support**: Full English/Japanese UI with instant language switching
- 🔍 **Enhanced Search Functionality**: Space-insensitive search for both OJ standards and ISO17025 certificates
- 🎯 **ISO17025 Scope Matching Fix**: Improved version-tolerant matching for standards with versions
- 🚀 **User Experience Improvements**: Persistent language preferences and responsive design
- 🔧 **Netlify Function Syntax Fix**: Resolved scope-search function Runtime.UserCodeSyntaxError
- 🆕 **Excel File Integration**: Parse official EC Excel files for real-time data
- 🆕 **Three-Directive Support**: RED, EMC, and LVD with directive-specific parsing
- 🆕 **ESO-Specific Portal Links**: Intelligent redirection to appropriate standards portals
- 🆕 **Clipboard Integration**: Auto-copy standard numbers for CEN/CENELEC portal searches
- 🆕 **Excel-Style Display**: Complete Excel column mapping with OJ references, ESO info, and withdrawal dates
- 🆕 **Date Conversion**: Automatic Excel serial date conversion (43056 → 17/11/2017)
- 🆕 **Status Indicators**: Current/Withdrawn status with visual differentiation
- 🆕 **Download Functionality**: Download original Excel files for secondary use
- 🆕 **Enhanced Data Accuracy**: Real-time access to latest harmonised standards
- 🆕 **RED Directive Date Display Enhancement**: Latest date from Excel columns E, H, J with corresponding OJ references
- 🆕 **Comprehensive ISO17025 Scope Matching**: Versioned standards match inclusive scope patterns (e.g., EN 301 489-52 V1.2.1 matches EN 301 489-1/-3/-7/-52)
- 🆕 **Smart OJ Reference Selection**: Dynamic selection of OJ references based on latest date column (RED: E→F, H→I, J→K)
- 🆕 **GitHub Integration**: Direct links to certificate scope documentation with proper anchor navigation
- 🆕 **Scope Search Functionality**: Search A2LA and JAB certificate scopes with intelligent matching
- 🆕 **Dynamic MD File Loading**: Certificate scope data loaded dynamically from external MD files
- 🆕 **Markdown Documentation**: External A2LA/JAB scope information with anchor links and annual update support
- 🆕 **Smart Standard Matching**: Prefix/version difference detection with detailed annotations
- 🆕 **No-Code Scope Updates**: Annual scope updates through MD file editing without code modifications
- 🆕 **Zero Hardcoding**: Complete elimination of hardcoded certificate data from JavaScript code
- 🆕 **Pure MD Architecture**: 100% MD file-driven certificate management system

**Production Release (August 2025):**
- ✅ **Complete Dependency Cleanup**: Removed axios/node-fetch dependencies, unified to Node.js 18+ built-in fetch
- ✅ **Production-Ready HTTP Client**: All Netlify Functions use consistent fetch API with proper error handling
- ✅ **Enhanced Configuration Management**: Centralized URL generation and debug logging in utils/config.js
- ✅ **Improved Download Functionality**: Fixed Excel download with proper Content-Length headers and binary handling
- ✅ **Resolved i18n Issues**: Fixed duplicate translation keys for better language management
- ✅ **Comprehensive Testing**: 81.61% accuracy in scope matching validation (JAB: 97.79%, A2LA: 65.44%)
- ✅ **Range Notation Support**: Enhanced A2LA scope matching for complex standard patterns (EN 302 065-1/-2/-3/-4)
- ✅ **Cross-Family Match Prevention**: Fixed false positives in comprehensive scope matching
- ✅ **Timeout Handling**: AbortController integration for robust API timeouts

**🎌 New Language Support:**
- **English/Japanese Interface**: Complete bilingual UI with real-time switching
- **Persistent Language Settings**: User preferences stored locally
- **Professional Japanese Translations**: Technical terms accurately translated
- **Responsive Language Switching**: No page reload required
---

## 主要機能

### 🌐 Web Application Features

#### 1. **Standards Access** 
- **Excel File Parsing**: Direct access to official EC harmonised standards Excel files
- **RED Standards**: Radio Equipment Directive (2014/53/EU) - 233+ standards
- **EMC Standards**: Electromagnetic Compatibility Directive (2014/30/EU) - 175+ standards
- **LVD Standards**: Low Voltage Directive (2014/35/EU) - 902+ standards
- **ESO-Aware Portal Links**: Intelligent routing to ETSI, CEN, or CENELEC portals
- **Clipboard Integration**: Auto-copy standard numbers for efficient searching
- **Download Capability**: Secondary use of original Excel files

#### 2. **Excel File Integration**
- **Real-time Parsing**: Automatic download and parsing of latest EC Excel files
- **Official Sources**: Direct integration with ec.europa.eu document repository
- **Complete Column Mapping**: All Excel fields including ESO, OJ references, restrictions
- **Date Conversion**: Automatic Excel serial date conversion (e.g., 43056 → 17/11/2017)
- **Status Detection**: Automatic identification of withdrawn standards with dates
- **File Downloads**: Base64-encoded Excel files for offline use
- **Comprehensive Metadata**: Standard numbers, titles, dates, and OJ references

#### 3. **Professional Display**
- **Excel-Style Layout**: Complete mapping of Excel columns in user-friendly format
- **ESO Indicators**: Standards organization badges (CEN, CENELEC, ETSI) with portal links
- **Smart Portal Links**: Automatic redirection to appropriate standards portals
- **OJ References**: Official Journal publication references with dates
- **Status Indicators**: Current/Withdrawn status with color-coded badges and withdrawal dates
- **Restriction Alerts**: Clear display of any restrictions or limitations
- **Date Formatting**: Human-readable dates (17/11/2017) instead of Excel serial numbers
- **Clipboard Features**: One-click copy of standard numbers for manual searches
- **Responsive Design**: Optimized for desktop and mobile devices
- **Download Buttons**: Easy access to original Excel files

#### 4. **ISO17025 Certificate Scope Analysis (Pure MD Architecture)**
- **Certificate Type Selection**: Choose between A2LA and JAB certificate types
- **Real-time MD Loading**: Direct loading from external MD files via API - zero hardcoded data
- **A2LA Certificate Support**: Dynamic loading of 80+ standards from `/static/data/a2la-scopes.md`
- **JAB Facility Display**: Japanese-style facility formatting with 【施設】structure from `/static/data/jab-scopes.md`  
- **Multi-Facility Support**: Dynamic facility parsing with location and standards data
- **Smart Scope Matching**: Real-time comparison of OJ Standards with MD-sourced certificate scopes
- **Color-Coded Results**: Visual indicators for exact match, prefix/version differences
- **Scope Search Functionality**: Search MD-based certificate scopes using partial standard numbers
- **Live MD Updates**: Instant reflection of MD file changes without code deployment
- **Zero-Maintenance Architecture**: No JavaScript code updates required for scope changes

#### 5. **Advanced Scope Matching & Search**
- **Real-time Scope Comparison**: Automatic matching of OJ Standards with ISO17025 certificate scopes
- **Smart Matching Algorithm**: Detects exact matches, prefix differences, version mismatches, and comprehensive patterns
- **Comprehensive Pattern Matching**: EN 301 489-52 V1.2.1 matches EN 301 489-1/-3/-7/-52 inclusively
- **Color-Coded Visual Results**: 🟢 Exact/Comprehensive match, 🟡 Prefix difference, 🟠 Version difference, ⚫ No match
- **Intelligent Annotations**: Detailed notes including "包括スコープ適用(489-52含む)" for comprehensive matches
- **Smart OJ Reference Display**: Shows OJ reference from latest date column (RED: E→F, H→I, J→K mapping)
- **Certificate Scope Search**: Search A2LA/JAB scopes using partial standard numbers
- **Facility Information**: Display which facility covers specific standards (JAB)
- **GitHub Integration**: Direct navigation to certificate scope MD files with proper anchor links
- **Markdown Integration**: Click-through to detailed scope documentation on GitHub
- **Export Functions**: Download results in CSV format
- **Real-time Results**: Live search and filtering capabilities

#### 6. **Pure MD File Architecture**
- **100% External Data**: Certificate scopes exclusively stored as editable Markdown files
- **Zero Hardcoding**: Complete elimination of hardcoded certificate data from JavaScript
- **Real-time API Loading**: Dynamic parsing of MD files via dedicated certificate-data API
- **No Fallback Dependency**: Enforced MD file usage ensures data consistency
- **Advanced MD Parsing**: Comprehensive facility, category, and standard extraction
- **Facility Structure Support**: JAB facility-based organization with Japanese formatting
- **Anchor Navigation**: Direct links to specific sections within scope documentation
- **Version Control Friendly**: Track scope changes through Git history
- **Instant Updates**: MD file changes take effect on next API call

### 🔧 Technical Features

#### 7. **Advanced Backend Processing**
- **Serverless Architecture**: Node.js functions for scalable processing
- **Excel Processing**: XLSX library integration for real-time file parsing
- **Predefined Data Management**: Comprehensive certificate standards databases
- **ESO Detection**: Automatic identification of standards organizations (CEN/CENELEC/ETSI)
- **Date Conversion Engine**: Automatic Excel serial date conversion (43056 → 17/11/2017)
- **Column Mapping**: Complete Excel field extraction and transformation
- **Enhanced Error Handling**: Robust fallback mechanisms and retry logic
- **Multi-format Support**: Handles various Excel formats and structures
- **Certificate Data Processing**: Structured A2LA and JAB standards organization
- **Japanese Standards Support**: Facility-based categorization with test method codes

#### 8. **Data Management**
- **Real-time Updates**: Direct access to latest EC Excel files
- **Configuration Management**: External JSON configuration for Excel URLs
- **API Compatibility**: RESTful endpoints for frontend integration
- **Cross-platform**: Compatible with web, mobile, and desktop applications

## 🚀 Quick Start

### Web Application (Recommended)

1. **Visit the Live Application**: [Lab Scope Checker](https://lab-scope-checker.seidaku.workers.dev)

2. **Select a Directive**: Choose from RED, EMC, or LVD

3. **Choose Access Method**: 
   - **Excel File (Parse hEN list)**: Real-time parsing of official EC Excel files
   - **ETSI Portal (Open in new tab)**: Direct access to ETSI standards portal

4. **View Standards**: Browse comprehensive standards lists with download options

5. **Download Excel Files**: Use download button for secondary use of official files

### Local Development

```bash
# Clone the repository
git clone https://github.com/username/Claude_standard_checker.git
cd Claude_standard_checker

# Cloudflare edition (current)
git checkout cloudflare-workers
npm install
npm run setup:local   # local D1 schema + seed
npm run dev           # http://localhost:8787

# Netlify edition (legacy)
git checkout netlify-pure-webapp && npm install && netlify dev
```

### Certificate Analysis

1. **Select Certificate Type**: Choose between A2LA or JAB certificate from dropdown menu
2. **Load Certificate Data**: Click "Load Certificate Data" button for instant access
   - **A2LA Certificates**: Complete database of 80+ standards across 20+ categories
   - **JAB Certificates**: Facility-based organization with Japanese formatting 【施設】
3. **View Facility Breakdown**: See standards organized by testing facilities and methods
4. **Compare Standards**: Select directive to compare against certificate standards
5. **View Coverage Report**: See detailed compliance analysis with facility breakdown

## 🔧 Configuration

### Cloudflare Deployment (current)

See **☁️ Cloudflare Workers 版** at the top of this document. Bindings and variables live in `wrangler.jsonc`:

| Name | Kind | Purpose |
|---|---|---|
| `ASSETS` | Static Assets | serves `static/` |
| `DB` | D1 | JAB / A2LA accreditation scopes (seeded from the MD files) |
| `CACHE` | KV | cached EC Excel files + metadata |
| `SCOPE_SOURCE_BRANCH` | var | branch used by "View Details" links to the scope MD on GitHub |
| `STANDARDS_RECHECK_SECONDS` | var | how often to ask the EC server whether the Excel changed (default 21600 = 6h) |

### Netlify Deployment (legacy branch `netlify-pure-webapp`)

Netlify Functions + static hosting, continuous deployment from Git. No longer the primary target.

## 📊 API Endpoints

Base path is **`/api`** on the Cloudflare edition (the legacy `/.netlify/functions` prefix still works as an alias). New in v3.0: `POST /api/quick-check`, `GET /api/scopes/status`, `GET /api/scope-oj-version-check`, `GET /api/me`, `GET /api/health`.

### Endpoints

The application provides RESTful API endpoints:

#### Bulk Accreditation Scope / OJ Edition Check
```javascript
// Compare every current JAB/A2LA scope item with active OJ editions
GET /api/scope-oj-version-check
```

The response reports `valid`, `warning` (the accreditation scope edition is older than the active OJ edition), `caution` (for example, the accreditation scope has no edition), and `not_listed`. If an active OJ entry has no edition number, the scope item is treated as valid regardless of its accreditation edition.

#### Excel File Processing
```javascript
// Parse standards from official Excel files
GET /.netlify/functions/standards?directive=EMC

// Response: Parsed standards data
{
  "success": true,
  "data": {
    "directive": "EMC",
    "directive_name": "Electromagnetic Compatibility Directive",
    "standards": [...],
    "count": 175
  }
}
```

#### Excel File Downloads
```javascript
// Download original Excel files
GET /.netlify/functions/download-excel?directive=RED

// Response: Base64-encoded Excel file with proper headers
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="EU_Harmonised_Standards_RED_2025-08-03.xlsx"
```

#### ESO-Specific Portal Integration
```javascript
// Smart portal redirection based on standards organization
// ETSI standards → ETSI Portal (with direct search)
// CEN/CENELEC standards → CEN-CENELEC Portal (with clipboard copy)

// ETSI Portal (direct search)
https://www.etsi.org/standards#page=1&search={standard_number}...

// CEN-CENELEC Portal (manual search with clipboard assistance)
https://standards.cencenelec.eu/dyn/www/f?p=CEN:105::RESET::::
// Standard number automatically copied to clipboard for pasting
```

#### Pure MD Certificate Data API
```javascript
// Load certificate data dynamically from MD files
GET /.netlify/functions/certificate-data?cert_type=a2la
GET /.netlify/functions/certificate-data?cert_type=jab

// No fallback to hardcoded data - enforces MD file usage
// Real-time parsing of MD files on each request
```

#### Certificate Data Access (Pure MD-Based)
```javascript
// Dynamic MD-based certificate data loading

// A2LA Certificate Response from MD file
{
  "success": true,
  "data": {
    "certificate_info": {
      "certificate_number": "A2LA-2022-01",
      "organization": "A2LA Accredited Testing Laboratory",
      "valid_until": "2025-12-31"
    },
    "test_standards": [...], // 80+ standards
    "categories": {
      "Radiated & Conducted": [...],
      "United States Radio": [...],
      "European Radio": [...],
      // 20+ categories
    },
    "certificate_type": "A2LA_MD_Dynamic"
  }
}

// JAB Certificate Response from MD file  
{
  "success": true,
  "data": {
    "certificate_type": "JAB_MD_Dynamic",
    "facilities": [
      {
        "facility_number": "1",
        "name": "SGS Japan Inc. Kitayamata Laboratory",
        "location": "神奈川県横浜市",
        "standards": [...], // Standards by test method
        "standards_count": 45
      },
      {
        "facility_number": "2", 
        "name": "TDK Corporation Nikaho Factory",
        "location": "秋田県にかほ市",
        "standards_count": 35
      }
    ],
    "total_standards": 80
  }
}
```

#### Scope Matching & Search
```javascript
// Real-time scope matching for OJ Standards
POST /.netlify/functions/scope-matcher
{
  "oj_standards": ["EN 55032:2015", "IEC 61000-4-2", "EN 300 328"]
}

// Response: Detailed matching results with annotations
{
  "success": true,
  "data": {
    "matches": [
      {
        "standard": "EN 55032:2015",
        "scope_matches": {
          "a2la": {
            "status": "comprehensive_match",
            "matched_standard": "EN 301 489-1/-3/-7/-52",
            "note": "包括スコープ適用(489-52含む)",
            "anchor": "#european-radio"
          },
          "jab": {
            "status": "comprehensive_match", 
            "matched_standard": "EN 301 489-1/-3/-7/-52",
            "note": "包括スコープ適用(489-52含む)",
            "anchor": "#facility-1-continuous-disturbance",
            "facility": "施設1: SGS Japan Inc."
          }
        }
      }
    ]
  }
}

// Certificate scope search
POST /.netlify/functions/scope-search
{
  "search_query": "55032"
}

// Response: Search results from both certificates
{
  "success": true,
  "data": {
    "total_matches": 3,
    "a2la_matches": [
      {
        "standard": "EN 55032",
        "description": "Electromagnetic compatibility of multimedia equipment",
        "match_type": "exact",
        "anchor": "#emissions-for-ports"
      }
    ],
    "jab_matches": [
      {
        "standard": "EN55032", 
        "description": "Electromagnetic compatibility of multimedia equipment (ITE only)",
        "match_type": "prefix_mismatch",
        "note": "スペース有無違い",
        "facility": "施設1: SGS Japan Inc.",
        "anchor": "#facility-1-continuous-disturbance"
      }
    ]
  }
}
```

### Integration Examples

#### JavaScript Frontend
```javascript
// Fetch standards from Excel files
async function fetchStandardsFromExcel(directive) {
  const response = await fetch(`/.netlify/functions/standards?directive=${directive}`);
  const data = await response.json();
  return data.data.standards;
}

// Download Excel file
function downloadExcelFile(directive) {
  const url = `/.netlify/functions/download-excel?directive=${directive}`;
  window.open(url, '_blank');
}
```

#### Node.js Backend
```javascript
// Process Excel files with XLSX
const XLSX = require('xlsx');

function parseExcelStandards(buffer, directive) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  return parseStandardsFromExcelData(jsonData, directive);
}
```

## 📱 Usage Examples

### Web Interface Output

#### Excel File Parsing with Complete Display
```
🔹 RED Standards (Excel File)
Successfully fetched 233 standards from Excel file for Radio Equipment Directive
📥 Download Excel File button available

📋 Standards List with Excel Information:
EN 50360:2017                                               RED | Cenelec
Product standard to demonstrate the compliance of wireless communication devices...

📋 Excel Details:
OJ Reference: OJ C 389 - 17/11/2017
Restriction: -
⚠️ Withdrawal Date: 31/05/2025  Ref: OJ L, 2023/2669 - 01/12/2023
Status: ❌ Withdrawn

EN 18031-1:2024                                             RED | CEN  
Common security requirements for radio equipment - Part 1...
🔗 CEN Portal (click to copy standard number and open portal)
Status: ✅ Current

EN 300 065 V2.1.2                                          RED | ETSI
Radio equipment in the 40 GHz to 246 GHz frequency range...
🔗 ETSI Portal (direct search)  
Status: ✅ Current
```

#### Multi-Directive Support
```
🔹 Available Directives:
• RED - Radio Equipment Directive (233 standards)
• EMC - Electromagnetic Compatibility Directive (175 standards)  
• LVD - Low Voltage Directive (902 standards)

🔹 Access Methods per Directive:
• Excel File (Parse hEN list) - Real-time parsing with ESO-specific portal links
• ETSI Portal (Open in new tab) - Direct portal access for ETSI standards
• CEN/CENELEC Portal - Clipboard-assisted portal access for CEN/CENELEC standards
```

#### Certificate Analysis with Smart Scope Matching
```
📋 Certificate Information
Certificate Number: A2LA-2022-01
Organization: A2LA Accredited Testing Laboratory
Valid Until: 2025-12-31
Total Standards: 80
Loading Method: Predefined database

📊 Standards by Category:
🔹 Radiated & Conducted (12 standards)
🔹 United States Radio (1 standard)
🔹 Canada Radio (9 standards)
🔹 European Radio (10 standards)
🔹 Emissions for Ports (2 standards)
🔹 EMC Immunity Standards (25+ standards)
🔹 Other Categories (20+ standards)

🔍 Scope Search Results for "55032":
📋 A2LA Certificate (1 match)
🟢 EN 55032 - Electromagnetic compatibility of multimedia equipment
   [View Details] → Opens A2LA scope documentation

📋 JAB Certificate (1 match)  
🟡 EN55032 - Electromagnetic compatibility of multimedia equipment (ITE only)
   ⚠️ スペース有無違い - 施設1: SGS Japan Inc.
   [View Details] → Opens JAB scope documentation

🔍 Real-time OJ Standards Scope Matching:
EN 301 489-52 V1.2.1                                       RED | ETSI
ElectroMagnetic Compatibility and Radio spectrum Matters (ERM) - Part 52

ISO17025 Certificate Scope:
A2LA 🟢 ⚠️ 包括スコープ適用(489-52含む)  JAB 🟢 ⚠️ 包括スコープ適用(489-52含む)

📋 Excel Details:
OJ Reference: OJ L 165 - 01/06/2025  (Latest date from column J → Reference from column K)
Status: ✅ Current
🔗 ETSI Portal (direct search)

EN 55032:2015                                               EMC | CEN
Electromagnetic compatibility of multimedia equipment - Emission requirements

ISO17025 Certificate Scope:
A2LA 🟢  JAB 🟡 ⚠️ スペース有無違い

📋 Excel Details:
OJ Reference: OJ C 275 - 16/08/2016
Status: ✅ Current
🔗 CEN Portal (click to copy and search)
```

#### JAB Certificate Analysis (Predefined Facilities)
```
📋 Certificate Information
Certificate Type: JAB_Predefined
Total Facilities: 2
Total Standards: 80
Loading Method: Predefined database

🏢 Facility Analysis:
【施設1】SGS Japan Inc. Kitayamata Laboratory（神奈川県横浜市）
Standards Count: 45
Test Methods: M21.4.1, M21.4.14, M21.4.15, M21.4.16...

🔹 Continuous Disturbance Tests
EN 55011, EN 55022:2010, IEC 60945, EN 60945, EN 61326-1...

🔹 Electrostatic Discharge (ESD) Tests
IEC 61000-4-2, EN 61000-4-2, JIS C 61000-4-2...

【施設2】TDK Corporation Nikaho Factory（秋田県にかほ市）
Standards Count: 35
Test Methods: M21.4.1, M21.4.3, M21.4.4, M21.4.10...

🔹 EMC Standards for Specific Equipment
EN 12015, EN 12016, EN 300 330...
```

## 🛠️ Technical Architecture

### Frontend Stack
- **HTML5**: Semantic markup with accessibility features
- **CSS3**: Modern responsive design with Flexbox/Grid
- **JavaScript ES6+**: Pure vanilla JavaScript, no frameworks
- **Font Awesome**: Professional iconography

### Backend Stack
- **Netlify Functions**: Node.js serverless runtime
- **Built-in Fetch**: Node.js 18+ native HTTP client (axios/node-fetch removed)
- **XLSX**: Excel file parsing and processing
- **AbortController**: Timeout handling for HTTP requests
- **utils/config.js**: Centralized configuration and URL management
- **Predefined Data**: Comprehensive certificate standards databases
- **Dynamic Processing**: Real-time data organization and categorization
- **Cheerio**: Server-side HTML parsing (fallback)
- **Dynamic Caching**: Intelligent performance optimization

### Data Sources
- **EC Excel Files**: Official European Commission harmonised standards lists
  - EMC: `https://ec.europa.eu/docsroom/documents/51315/attachments/1/translations/en/renditions/native`
  - RED: `https://ec.europa.eu/docsroom/documents/64475/attachments/1/translations/en/renditions/native`
  - LVD: `https://ec.europa.eu/docsroom/documents/62995/attachments/1/translations/en/renditions/native`
- **ETSI Portal**: Cross-reference integration
- **EUR-Lex**: Official Journal fallback system

### File Structure (Web Application)
```
netlify-pure-webapp/
├── netlify/
│   └── functions/
│       ├── utils/
│       │   ├── config.js        # Centralized configuration and URL management
│       │   └── md.js            # Markdown parsing utilities
│       ├── standards.js         # Excel parsing & standards fetching (fetch-based)
│       ├── download-excel.js    # Excel file download service (fetch + Buffer)
│       ├── batch-compare.js     # Batch directive comparison (fetch + AbortController)
│       ├── scope-matcher.js     # Real-time scope matching with dynamic MD loading
│       ├── scope-search.js      # Certificate scope search with dynamic MD loading
│       ├── certificate-data.js  # Pure MD-based certificate loading API
│       ├── parse-md-scopes.js   # MD file parsing API endpoint
│       ├── certificate.js      # Basic certificate validation (minimal)
│       └── directives.js       # Directive metadata
├── static/
│   ├── api/
│   │   └── directives.json     # Directive configuration with Excel URLs
│   ├── data/
│   │   ├── a2la-scopes.md      # A2LA certificate scope documentation (pure MD source)
│   │   └── jab-scopes.md       # JAB certificate scope documentation (pure MD source)  
│   ├── index.html              # Main application
│   ├── script.js               # Frontend logic with 100% MD-based certificate loading
│   └── style.css               # ETSI-compliant styling with scope matching UI
├── package.json                # Node.js dependencies (includes xlsx)
└── README.md                  # This documentation
```

### Performance Features
- **CDN Delivery**: Global content distribution via Netlify
- **Excel Caching**: Intelligent caching of parsed Excel data
- **Lazy Loading**: Progressive content loading
- **Error Handling**: Graceful degradation and retry logic
- **Base64 Encoding**: Efficient binary file transfer

## 📈 Standards Coverage

### Current Statistics (August 2025)
- **RED (Radio Equipment)**: 233 harmonised standards
- **EMC (Electromagnetic Compatibility)**: 175 harmonised standards
- **LVD (Low Voltage)**: 902 harmonised standards
- **Total Coverage**: 1,310+ EU harmonised standards
- **Data Freshness**: Real-time from official EC sources

### Standard Format Examples with Portal Integration
```
📋 Current Standards with Portal Links:
EN 18031-1:2024 (CEN) - Common security requirements for radio equipment - Part 1
OJ Reference: OJ C 127 - 15/04/2024 | 🔗 CEN Portal (auto-copy) | Status: ✅ Current

📋 Withdrawn Standards:  
EN 50360:2017 (Cenelec) - Product standard for wireless communication devices
OJ Reference: OJ C 389 - 17/11/2017 | 🔗 CENELEC Portal (auto-copy) | ⚠️ Withdrawn: 31/05/2025

📋 ETSI Standards:
EN 300 065 V2.1.2 (ETSI) - Radio equipment in the 40 GHz to 246 GHz frequency range
🔗 ETSI Portal (direct search) | Status: ✅ Current

Portal Mapping:
• CEN/CENELEC → https://standards.cencenelec.eu/ (with clipboard copy)
• ETSI → https://www.etsi.org/standards (direct search)
```

## ⚠️ Important Notes

### Usage Guidelines
- **Rate Limiting**: Reasonable intervals for Excel file requests
- **ETSI Portal**: Comply with ETSI's terms of service for portal access
- **Certificate Data**: Predefined databases provide instant access without file uploads
- **Browser Compatibility**: Optimized for modern browsers (Chrome, Firefox, Safari, Edge)
- **Excel File Size**: Large files (up to ~90KB) handled efficiently
- **Data Security**: No file uploads required - all certificate data is predefined
- **Performance**: Instant loading of comprehensive certificate standards databases

### Data Sources
- **Official EC Excel Files**: Authoritative source for harmonised standards
- **Real-time Updates**: Always current with latest published lists
- **Fallback System**: Cached data ensures availability during service interruptions
- **ETSI Integration**: Cross-referencing with official ETSI portal

## 🎯 Zero-Hardcoding Achievement

### Complete Elimination of Hardcoded Certificate Data

**Previously (Pre-2025):** The application contained 192+ hardcoded certificate standards directly embedded in JavaScript code, requiring manual code updates for annual scope changes.

**Now (August 2025):** 100% MD file-driven architecture with zero hardcoded certificate data in JavaScript.

#### Benefits of Pure MD Architecture:

✅ **Zero Code Maintenance**: Annual scope updates require zero JavaScript modifications  
✅ **Instant Updates**: MD file changes take effect immediately via API  
✅ **Version Control**: Full scope change tracking through Git history  
✅ **Data Consistency**: Single source of truth in MD files  
✅ **Error Reduction**: Eliminates risk of code/data desynchronization  
✅ **Scalable**: Easy addition of new certificate types  
✅ **Auditable**: Clear separation between code logic and certificate data  

#### Implementation Highlights:

- **Removed**: 192 hardcoded standard entries from `script.js`
- **Added**: Dynamic `/certificate-data` API endpoint
- **Enhanced**: Real-time MD file parsing with facility support
- **Implemented**: Comprehensive scope matching for versioned vs. inclusive patterns
- **Improved**: RED directive date/OJ reference display with column-specific mapping
- **Fixed**: GitHub integration with proper branch references and anchor navigation
- **Maintained**: Full backward compatibility for existing functionality
- **Improved**: Error handling with enforcement of MD file usage

## 📝 Certificate Scope MD File Management

### MD File Structure

The application uses external Markdown files to store certificate scope information, enabling annual updates without code modifications.

#### A2LA Certificate MD File (`/static/data/a2la-scopes.md`)

```markdown
# A2LA Certificate Scope Information

**Certificate Number:** A2LA-2022-01  
**Organization:** A2LA Accredited Testing Laboratory  
**Valid Until:** 2025-12-31  
**Accreditation Body:** A2LA  

## Test Categories

### Radiated & Conducted {#radiated-conducted}

- **CFR 47 FCC Part 15B (ANSI C63.4:2014)** - Unintentional Radiators
- **FCC Part 18 (MP-5:1986)** - Industrial, Scientific, and Medical Equipment
- **CISPR 11** - Industrial, scientific and medical equipment
- **EN 55011** - Industrial, scientific and medical equipment

### European Radio {#european-radio}

- **ETSI EN 301 091-1/-2/-3** - Electromagnetic compatibility and Radio spectrum Matters (ERM)
- **EN 301 783** - Land Mobile Service
- **EN 301 893** - 5 GHz high performance RLAN
```

#### JAB Certificate MD File (`/static/data/jab-scopes.md`)

```markdown
# JAB Certificate Scope Information

**Certificate Number:** RTL02770  
**Organization:** SGS Japan Inc. & TDK Corporation - JAB Accredited Testing Facilities  
**Valid Until:** 2028-12-31  
**Accreditation Body:** JAB  

## Facility 1: SGS Japan Inc. Kitayamata Laboratory {#facility-1}
**Location:** 神奈川県横浜市

### Continuous Disturbance Tests {#facility-1-continuous-disturbance}

- **EN 55011** - Industrial, scientific and medical equipment (except 10)
- **EN 55022:2010** - Information technology equipment (except 7)
- **IEC 60945** - Maritime navigation and radiocommunication equipment

### ESD Tests {#facility-1-esd}

- **IEC 61000-4-2** - Electrostatic discharge immunity test
- **EN 61000-4-2** - Electrostatic discharge immunity test
- **JIS C 61000-4-2** - Japanese ESD immunity test
```

### MD File Format Rules

#### Required Elements:
1. **Certificate Metadata** (top of file):
   ```markdown
   **Certificate Number:** XXX  
   **Organization:** Organization Name  
   **Valid Until:** YYYY-MM-DD  
   **Accreditation Body:** A2LA/JAB  
   ```

2. **Section Headers with Anchors**:
   ```markdown
   ### Category Name {#anchor-id}
   ```

3. **Standard Entries**:
   ```markdown
   - **STANDARD NUMBER** - Description text
   ```

#### A2LA Specific Format:
- Simple category-based organization
- No facility information required
- Direct standard listing under categories

#### JAB Specific Format:
- Facility-based organization with Japanese formatting
- Facility headers: `## Facility X: Name {#facility-x}`
- Location information: `**Location:** 都道府県市区町村`
- Standards grouped by test categories within facilities

### Annual Scope Update Procedure

#### Step 1: Obtain Latest Certificate Information
```bash
# Download latest A2LA/JAB certificate documents
# Extract scope information from official PDFs/documents
```

#### Step 2: Update MD Files
```bash
# Edit the relevant MD file
vim /static/data/a2la-scopes.md  # For A2LA updates
vim /static/data/jab-scopes.md   # For JAB updates
```

#### Step 3: Follow MD Format Rules
- **Add new standards**: Follow existing pattern with `- **STANDARD** - Description`
- **Update categories**: Create new sections with `### Category {#anchor}`
- **Remove outdated standards**: Delete entire lines for withdrawn standards
- **Update metadata**: Modify certificate validity dates and numbers

#### Step 4: Test Changes Locally
```bash
# Start development server
netlify dev

# Test scope matching functionality
# Test scope search functionality  
# Verify anchor links work correctly
```

#### Step 5: Deploy Changes
```bash
# Commit changes
git add static/data/*.md
git commit -m "Update certificate scopes for 2025"

# Push to production
git push origin master
```

### MD File Parsing Features

#### Automatic Parsing:
- **Standard Extraction**: Automatically parses `- **STANDARD** - Description` format
- **Anchor Generation**: Creates clickable links from `{#anchor-id}` patterns
- **Facility Detection**: Recognizes JAB facility structure for proper organization
- **Fallback System**: Uses hardcoded data if MD files are unavailable

#### Dynamic Loading Benefits:
- **No Code Changes**: Update scopes without modifying JavaScript functions
- **Immediate Effect**: Changes take effect on next API call
- **Version Control**: Track scope changes through Git history
- **Error Resilience**: Graceful fallback to hardcoded data prevents system failures

### Supported Standard Formats

The MD parser recognizes these standard number formats:
- **Basic**: `EN 55032`, `IEC 61000-4-2`, `CISPR 11`
- **With Versions**: `EN 55032:2015`, `ISO 7637-2(2004)`
- **Multi-part**: `EN 301 489-1/-3/-7/-9`
- **Complex**: `CFR 47 FCC Part 15B (ANSI C63.4:2014)`
- **Japanese**: `JIS C 61000-4-2`, `VCCI rule V-3`

### Troubleshooting MD File Issues

#### Common Issues:
1. **Standards not appearing**: Check `- **` prefix and `**` closure
2. **Anchors not working**: Verify `{#anchor-id}` format in section headers
3. **Facility parsing failed**: Ensure correct Japanese formatting for JAB
4. **Search not finding results**: Check standard number format and spelling

#### Debug Commands:
```bash
# Test MD file parsing
node -e "
const fs = require('fs');
const content = fs.readFileSync('static/data/a2la-scopes.md', 'utf-8');
console.log('Standards found:', content.match(/- \*\*[^*]+\*\*/g)?.length || 0);
console.log('Anchors found:', content.match(/\{#[^}]+\}/g)?.length || 0);
"
```

## 🔧 Development & Contributing

### Local Development Setup

```bash
# Prerequisites
node -v  # Requires Node.js 16+
npm -v   # Requires npm 8+

# Clone and setup
git clone https://github.com/username/Claude_standard_checker.git
cd Claude_standard_checker
git checkout netlify-pure-webapp

# Install dependencies
npm install

# Start local development
netlify dev --port 3000
```

### Adding New Directives

To add support for new EU directives:

1. **Update DIRECTIVE_CONFIG** in `netlify/functions/standards.js`:
```javascript
const DIRECTIVE_CONFIG = {
  NEW_DIR: {
    name: 'New Directive Name',
    excel_url: 'https://ec.europa.eu/docsroom/documents/XXXXX/attachments/1/translations/en/renditions/native',
    ec_webpage: 'https://single-market-economy.ec.europa.eu/new-directive',
    fallback_urls: ['https://eur-lex.europa.eu/new-oj-link']
  }
};
```

2. **Update directives.json** in `static/api/directives.json`:
```json
{
  "code": "NEW_DIR",
  "name": "New Directive Name",
  "description": "New Directive Description",
  "directive_number": "2024/XX/EU",
  "excel_url": "https://ec.europa.eu/docsroom/documents/XXXXX/..."
}
```

3. **Add frontend support** in `static/script.js` for new directive handling

4. **Test thoroughly** with real Excel files to ensure proper parsing

### Excel Parsing Enhancement

Improve Excel parsing by updating column mappings in `parseStandardsFromExcelData()`:

```javascript
// Adjust column indexes based on Excel file structure
if (directive === 'NEW_DIR') {
  standardNumber = row[X] ? String(row[X]).trim() : '';  // Adjust X
  title = row[Y] ? String(row[Y]).trim() : '';           // Adjust Y
  versionOrDate = row[Z] ? String(row[Z]).trim() : '';   // Adjust Z
}
```

## 🌐 Browser Support

| Browser | Version | Excel Support | Download Support | Status |
|---------|---------|---------------|------------------|--------|
| Chrome | 90+ | ✅ Full | ✅ Base64 | ✅ Full Support |
| Firefox | 88+ | ✅ Full | ✅ Base64 | ✅ Full Support |
| Safari | 14+ | ✅ Full | ✅ Base64 | ✅ Full Support |
| Edge | 90+ | ✅ Full | ✅ Base64 | ✅ Full Support |
| Mobile | iOS 14+, Android 10+ | ✅ Responsive | ✅ Mobile | ✅ Responsive |

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/excel-enhancement`)
3. Commit changes (`git commit -am 'Add Excel parsing improvements'`)
4. Push to branch (`git push origin feature/excel-enhancement`)
5. Create Pull Request

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/username/Claude_standard_checker/issues)
- **Discussions**: [GitHub Discussions](https://github.com/username/Claude_standard_checker/discussions)
- **Email**: support@eu-harmonized-standards.com

---

**Built with ❤️ for EU compliance professionals**

*Featuring comprehensive Excel integration for real-time access to official EC harmonised standards data across RED, EMC, and LVD directives.*
