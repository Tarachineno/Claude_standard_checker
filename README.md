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
- 🆕 **OCR Certificate Processing**: Advanced PDF analysis with optical character recognition
- 🆕 **Japanese Standards Support**: JAB facility parsing and multi-language OCR
- 🆕 **Image-based PDF Support**: Automatic detection and OCR processing for scanned certificates
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

#### 4. **Advanced Certificate Analysis**
- **PDF Processing**: ISO17025 certificate analysis and standard extraction
- **OCR Technology**: Automatic detection and processing of image-based/scanned PDFs
- **Multi-language Support**: English and Japanese text recognition with Tesseract.js
- **JAB Facility Parsing**: Specialized extraction for Japanese accreditation certificates
- **A2LA Certificate Support**: Comprehensive extraction of 85+ standards from US certificates
- **Standards Comparison**: Compare certificate scope with EU harmonized standards
- **Coverage Reports**: Detailed compliance analysis with percentage coverage
- **Batch Processing**: Compare against multiple directives simultaneously
- **Facility-based Analysis**: Extract multiple laboratory facilities from single certificate

#### 5. **Search & Export**
- **Advanced Search**: Find specific standards across all directives
- **Export Functions**: Download results in CSV format
- **Real-time Results**: Live search and filtering capabilities
- **Cross-referencing**: Direct links to ETSI portal for detailed specifications

### 🔧 Technical Features

#### 6. **Advanced Backend Processing**
- **Serverless Architecture**: Node.js functions for scalable processing
- **Excel Processing**: XLSX library integration for real-time file parsing
- **OCR Engine**: Tesseract.js with English and Japanese language packs
- **PDF Processing**: Multi-format PDF support with pdf-parse and OCR fallback
- **ESO Detection**: Automatic identification of standards organizations (CEN/CENELEC/ETSI)
- **Date Conversion Engine**: Automatic Excel serial date conversion (43056 → 17/11/2017)
- **Column Mapping**: Complete Excel field extraction and transformation
- **Enhanced Error Handling**: Robust fallback mechanisms and retry logic
- **Multi-format Support**: Handles various Excel formats and structures
- **Image Processing**: PDF-to-image conversion with pdf2pic for OCR processing
- **Multi-language OCR**: Japanese facility parsing with specialized patterns

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

### Advanced Certificate Analysis

1. **Upload Certificate**: Drag and drop ISO17025 PDF certificate (supports both text-based and image-based PDFs)
2. **Automatic Processing**: System detects PDF type and applies appropriate extraction method
   - **Text-based PDFs**: Direct text extraction (A2LA certificates: 85+ standards)
   - **Image-based PDFs**: OCR processing with Japanese/English support (JAB certificates)
3. **Facility Extraction**: Parse multiple laboratory facilities from single certificate
4. **Compare Standards**: Select directive to compare against extracted standards
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

#### Certificate Processing
```javascript
// Upload and process certificate (supports OCR)
POST /.netlify/functions/certificate
Content-Type: multipart/form-data

// Response for text-based PDF (A2LA)
{
  "success": true,
  "data": {
    "certificate_info": {
      "certificate_number": "7080.01",
      "organization": "SGS JAPAN INC.",
      "valid_until": "2025-11-30"
    },
    "test_standards": [...], // 85+ standards
    "categories": {...},
    "certificate_type": "Standard"
  }
}

// Response for image-based PDF (JAB with OCR)
{
  "success": true,
  "data": {
    "certificate_type": "JAB_Facilities",
    "facilities": [
      {
        "facility_number": "1",
        "name": "SGS Japan Inc. Kitayamata Laboratory",
        "location": "神奈川県横浜市",
        "standards": [...], // 75+ standards per facility
        "standards_count": 75
      }
    ],
    "total_standards": 150
  }
}
```

#### Standards Search
```javascript
// Search across all standards
GET /.netlify/functions/search?q=301%20489

// Certificate comparison
POST /.netlify/functions/compare
{
  "directive": "RED",
  "iso_standards": [...]
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

#### Certificate Analysis Report (A2LA Text-based PDF)
```
📋 Certificate Information
Certificate Number: 7080.01
Organization: SGS JAPAN INC.
Valid Until: 2025-12-31
Total Standards: 85
Extraction Method: Direct text parsing

📊 Standards by Category:
🔹 United States Radio (5 standards)
🔹 European Radio (28 standards)
🔹 Emissions Standards (12 standards)
🔹 EMC Immunity Standards (23 standards)
🔹 Other Standards (17 standards)

📊 Comparison Results - EMC
Coverage: 73.7% (28/38 matched)
Excel Standards: 175
ISO Standards: 85

✅ Matched Standards (28)
EN 55032:2015 ↔ EN 55032 (Multimedia Equipment EMC)
EN 55035:2017 ↔ EN 55035 (Multimedia Equipment Immunity)
EN 61000-3-2:2014 ↔ EN 61000-3-2 (Harmonic Current Limits)
```

#### JAB Certificate Analysis (Image-based PDF with OCR)
```
📋 Certificate Information
Certificate Type: JAB_Facilities (OCR processed)
Total Facilities: 2
Total Standards: 150+
Extraction Method: OCR (Tesseract.js with Japanese/English)

🏢 Facility Analysis:
【施設1】SGS Japan Inc. Kitayamata Laboratory（神奈川県横浜市）
Standards Count: 75
Classifications: M21.4.1, M21.4.14, M21.4.15, M21.4.16...

🔹 M21.4.1 Continuous disturbance tests
EN 55011, EN 55022:2010, IEC 60945, EN 60945, EN 61326-1...

🔹 M21.4.14 Electrostatic discharge immunity tests
EN 55024, EN 55035, CISPR35, EN 60945, IEC 60945, IEC 61000-4-2...

【施設2】TDK Corporation Nikaho Factory（秋田県にかほ市）
Standards Count: 80
Classifications: M21.4.1, M21.4.3, M21.4.4, M21.4.10...
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
- **PDF-parse**: Text extraction from PDF documents
- **Tesseract.js**: OCR engine with multi-language support (English/Japanese)
- **PDF2pic**: PDF to image conversion for OCR processing
- **Canvas**: Server-side image processing for OCR optimization
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
│       ├── search.js           # Standards search
│       ├── compare.js          # ISO17025 comparison
│       ├── batch-compare.js    # Batch processing
│       ├── certificate.js     # Advanced PDF processing with OCR
│       └── directives.js      # Directive metadata
├── static/
│   ├── api/
│   │   └── directives.json    # Directive configuration with Excel URLs
│   ├── index.html             # Main application
│   ├── script.js              # Frontend logic with Excel integration
│   └── style.css              # ETSI-compliant styling
├── package.json               # Node.js dependencies (includes xlsx)
└── README.md                 # This documentation
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
- **PDF Security**: Ensure confidentiality when uploading ISO17025 certificates
- **OCR Processing**: Image-based PDFs require additional processing time for OCR
- **File Size Limits**: PDF certificates up to 16MB supported
- **Browser Compatibility**: Optimized for modern browsers (Chrome, Firefox, Safari, Edge)
- **Excel File Size**: Large files (up to ~90KB) handled efficiently
- **OCR Dependencies**: Full OCR requires ImageMagick/GraphicsMagick in production environment

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