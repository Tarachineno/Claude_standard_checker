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
- 🆕 **Download Functionality**: Download original Excel files for secondary use
- 🆕 **Enhanced Data Accuracy**: Real-time access to latest harmonised standards
- 🆕 **Professional Display**: ETSI-compliant formatting with comprehensive metadata
- 🆕 **Dual Access Methods**: Both Excel parsing and ETSI portal access
---

## 主要機能

### 🌐 Web Application Features

#### 1. **Standards Access** 
- **Excel File Parsing**: Direct access to official EC harmonised standards Excel files
- **RED Standards**: Radio Equipment Directive (2014/53/EU) - 233+ standards
- **EMC Standards**: Electromagnetic Compatibility Directive (2014/30/EU) - 175+ standards
- **LVD Standards**: Low Voltage Directive (2014/35/EU) - 902+ standards
- **ETSI Portal Integration**: Alternative access via official ETSI portal
- **Download Capability**: Secondary use of original Excel files

#### 2. **Excel File Integration**
- **Real-time Parsing**: Automatic download and parsing of latest EC Excel files
- **Official Sources**: Direct integration with ec.europa.eu document repository
- **Data Accuracy**: Always current with latest harmonised standards lists
- **File Downloads**: Base64-encoded Excel files for offline use
- **Comprehensive Metadata**: Standard numbers, titles, dates, and OJ references

#### 3. **Professional Display**
- **ETSI-compliant Formatting**: Standards displayed as "EN 301 489-17 V3.2.1 (2023-08)"
- **Hierarchical Layout**: Professional typography matching ETSI portal style
- **Status Indicators**: Current/Withdrawn status with color-coded badges
- **Responsive Design**: Optimized for desktop and mobile devices
- **Download Buttons**: Easy access to original Excel files

#### 4. **Certificate Analysis**
- **PDF Processing**: ISO17025 certificate analysis and standard extraction
- **Standards Comparison**: Compare certificate scope with EU harmonized standards
- **Coverage Reports**: Detailed compliance analysis with percentage coverage
- **Batch Processing**: Compare against multiple directives simultaneously

#### 5. **Search & Export**
- **Advanced Search**: Find specific standards across all directives
- **Export Functions**: Download results in CSV format
- **Real-time Results**: Live search and filtering capabilities
- **Cross-referencing**: Direct links to ETSI portal for detailed specifications

### 🔧 Technical Features

#### 6. **Netlify Functions Backend**
- **Serverless Architecture**: Node.js functions for scalable processing
- **Excel Processing**: XLSX library integration for real-time file parsing
- **Enhanced Error Handling**: Robust fallback mechanisms and retry logic
- **Multi-format Support**: Handles various Excel formats and structures

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

1. **Upload Certificate**: Drag and drop ISO17025 PDF certificate
2. **Compare Standards**: Select directive to compare against
3. **View Coverage Report**: See detailed compliance analysis

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

#### ETSI Portal Integration
```javascript
// Redirect to ETSI portal for directive
GET /.netlify/functions/standards?directive=RED&method=etsi

// Response: Opens ETSI portal in new tab
// RED: https://www.etsi.org/standards#version=1&collection=RED&historical=0&sort=3
// EMC: https://www.etsi.org/standards#version=1&collection=EMC&historical=0&sort=3
// LVD: https://www.etsi.org/standards#version=1&collection=LVD&historical=0&sort=3
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

#### Excel File Parsing
```
🔹 EMC Standards (Excel File)
Successfully fetched 175 standards from Excel file for Electromagnetic Compatibility Directive
📥 Download Excel File button available

📋 Standards List:
EN 617:2001+A1:2010 - Continuous handling equipment and systems - Safety and EMC requirements...
EN 618:2002+A1:2010 - Continuous handling equipment and systems - Safety and EMC requirements...
EN 619:2002+A1:2010 - Continuous handling equipment and systems - Safety and EMC requirements...
```

#### Multi-Directive Support
```
🔹 Available Directives:
• RED - Radio Equipment Directive (233 standards)
• EMC - Electromagnetic Compatibility Directive (175 standards)  
• LVD - Low Voltage Directive (902 standards)

🔹 Access Methods per Directive:
• Excel File (Parse hEN list) - Real-time parsing
• ETSI Portal (Open in new tab) - Official portal access
```

#### Certificate Analysis Report
```
📋 Certificate Information
Certificate Number: 7080.01
Organization: SGS JAPAN INC.
Valid Until: 2025-12-31
Total Standards: 38

📊 Comparison Results - EMC
Coverage: 73.7% (28/38 matched)
Excel Standards: 175
ISO Standards: 38

✅ Matched Standards (28)
EN 55032:2015 ↔ EN 55032 (Multimedia Equipment EMC)
EN 55035:2017 ↔ EN 55035 (Multimedia Equipment Immunity)
EN 61000-3-2:2014 ↔ EN 61000-3-2 (Harmonic Current Limits)
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
│       ├── certificate.js     # PDF processing
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

### Standard Format Examples
```
EN 18031-1:2024 - Common security requirements for radio equipment - Part 1
EN 55032:2015 - Electromagnetic compatibility of multimedia equipment - Emission requirements
EN ISO 11252:2013 - Lasers and laser-related equipment - Laser device - Minimum requirements
```

## ⚠️ Important Notes

### Usage Guidelines
- **Rate Limiting**: Reasonable intervals for Excel file requests
- **ETSI Portal**: Comply with ETSI's terms of service for portal access
- **PDF Security**: Ensure confidentiality when uploading ISO17025 certificates
- **Browser Compatibility**: Optimized for modern browsers (Chrome, Firefox, Safari, Edge)
- **Excel File Size**: Large files (up to ~90KB) handled efficiently

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