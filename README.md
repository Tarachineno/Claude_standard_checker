# EU Harmonized Standards Checker

A comprehensive web application for accessing EU harmonized standards and comparing with ISO17025 certificates. Built with pure JavaScript and deployed on Netlify with advanced Excel file integration.

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
- 🆕 **Excel File Integration**: Parse official EC Excel files for real-time data
- 🆕 **Three-Directive Support**: RED, EMC, and LVD with directive-specific parsing
- 🆕 **ESO-Specific Portal Links**: Intelligent redirection to appropriate standards portals
- 🆕 **Clipboard Integration**: Auto-copy standard numbers for CEN/CENELEC portal searches
- 🆕 **Excel-Style Display**: Complete Excel column mapping with OJ references, ESO info, and withdrawal dates
- 🆕 **Date Conversion**: Automatic Excel serial date conversion (43056 → 17/11/2017)
- 🆕 **Status Indicators**: Current/Withdrawn status with visual differentiation
- 🆕 **Download Functionality**: Download original Excel files for secondary use
- 🆕 **Enhanced Data Accuracy**: Real-time access to latest harmonised standards
- 🆕 **ISO17025 Certificate Scope Matching**: Real-time scope comparison with color-coded matching results
- 🆕 **Scope Search Functionality**: Search A2LA and JAB certificate scopes with intelligent matching
- 🆕 **Markdown Documentation**: External A2LA/JAB scope information with anchor links
- 🆕 **Smart Standard Matching**: Prefix/version difference detection with detailed annotations
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

#### 4. **ISO17025 Certificate Scope Analysis**
- **Certificate Type Selection**: Choose between A2LA and JAB certificate types
- **Instant Data Loading**: No file upload required - comprehensive predefined databases
- **A2LA Certificate Support**: Complete database of 80+ standards across multiple categories
- **JAB Facility Display**: Japanese-style facility formatting with 【施設】structure
- **Multi-Facility Support**: Two Japanese facilities with comprehensive test standards
- **Smart Scope Matching**: Real-time comparison of OJ Standards with certificate scopes
- **Color-Coded Results**: Visual indicators for exact match, prefix/version differences
- **Scope Search Functionality**: Search certificate scopes using partial standard numbers
- **Markdown Documentation**: External A2LA/JAB scope documentation with anchor links
- **Facility-based Analysis**: Organized by test method classifications (M21.4.x)

#### 5. **Advanced Scope Matching & Search**
- **Real-time Scope Comparison**: Automatic matching of OJ Standards with ISO17025 certificate scopes
- **Smart Matching Algorithm**: Detects exact matches, prefix differences, version mismatches
- **Color-Coded Visual Results**: 🟢 Exact match, 🟡 Prefix difference, 🟠 Version difference, ⚫ No match
- **Intelligent Annotations**: Detailed notes for prefix/version differences (e.g., "EN/CISPR表記違い")
- **Certificate Scope Search**: Search A2LA/JAB scopes using partial standard numbers
- **Facility Information**: Display which facility covers specific standards (JAB)
- **Markdown Integration**: Click-through to detailed scope documentation
- **Export Functions**: Download results in CSV format
- **Real-time Results**: Live search and filtering capabilities

### 🔧 Technical Features

#### 6. **Advanced Backend Processing**
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

#### 7. **Data Management**
- **Real-time Updates**: Direct access to latest EC Excel files
- **Configuration Management**: External JSON configuration for Excel URLs
- **API Compatibility**: RESTful endpoints for frontend integration
- **Cross-platform**: Compatible with web, mobile, and desktop applications

## 🚀 Quick Start

### Web Application (Recommended)

1. **Visit the Live Application**: [EU Harmonized Standards Checker](https://eu-harmonized-standards.netlify.app)

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

# Switch to web application branch
git checkout netlify-pure-webapp

# Install dependencies (for Netlify Functions)
npm install

# Start local development server
netlify dev
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

### Netlify Deployment

The application is automatically deployed via Netlify with:
- **Netlify Functions**: Serverless backend processing
- **Static Hosting**: Frontend served from CDN
- **Continuous Deployment**: Automatic updates from Git

### Environment Variables

```bash
# Optional: Configure custom settings
NETLIFY_SITE_URL=your-site-url
EXCEL_FETCH_TIMEOUT=30000
XLSX_PARSING_MODE=buffer
```

## 📊 API Endpoints

### Netlify Functions

The application provides RESTful API endpoints:

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

#### Certificate Data Access
```javascript
// Predefined certificate data structure

// A2LA Certificate Response
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
    "certificate_type": "A2LA_Predefined"
  }
}

// JAB Certificate Response
{
  "success": true,
  "data": {
    "certificate_type": "JAB_Predefined",
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
            "status": "exact_match",
            "matched_standard": "EN 55032",
            "note": null,
            "anchor": "#emissions-for-ports"
          },
          "jab": {
            "status": "prefix_mismatch", 
            "matched_standard": "EN55032",
            "note": "スペース有無違い",
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
- **Axios**: HTTP client for Excel file fetching
- **XLSX**: Excel file parsing and processing
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
│       ├── standards.js         # Excel parsing & standards fetching
│       ├── download-excel.js    # Excel file download service
│       ├── scope-matcher.js     # Real-time scope matching for OJ Standards
│       ├── scope-search.js      # Certificate scope search functionality
│       ├── certificate.js      # Basic certificate validation (minimal)
│       └── directives.js       # Directive metadata
├── static/
│   ├── api/
│   │   └── directives.json     # Directive configuration with Excel URLs
│   ├── data/
│   │   ├── a2la-scopes.md      # A2LA certificate scope documentation
│   │   └── jab-scopes.md       # JAB certificate scope documentation  
│   ├── index.html              # Main application
│   ├── script.js               # Frontend logic with scope matching integration
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