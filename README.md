# EU Harmonized Standards Checker

A modern web application for checking EU harmonized standards compliance and comparing with ISO17025 certificates. Built with pure JavaScript and deployed on Netlify.

---
**🌟 Pure JavaScript Web Application (2025)**

- ✅ **Zero-dependency Frontend**: Pure JavaScript, HTML5, CSS3
- ✅ **Netlify Functions Backend**: Node.js serverless functions  
- ✅ **Dual Fetch Methods**: Official Journal parsing + ETSI Portal integration
- ✅ **ETSI-compliant Display**: Professional formatting matching ETSI standards
- ✅ **Responsive Design**: Mobile-first, professional interface
- ✅ **Real-time Processing**: Dynamic EUR-Lex integration with enhanced regex patterns
- ✅ **Instant Deployment**: Automatic CI/CD with Netlify

**Latest Updates (August 2025):**
- 🆕 **ETSI-style formatting**: Complete standard numbers with versions in bold (e.g., "EN 301 489-17 V3.2.1")
- 🆕 **Dual fetch methods**: Choose between Official Journal parsing or ETSI Portal redirects
- 🆕 **Enhanced regex patterns**: Improved standard detection from OJ documents
- 🆕 **Professional display**: ETSI-compliant typography and layout
- 🆕 **Dynamic OJ discovery**: Automatic detection of new Official Journal links
---

## 主要機能

### 🌐 Web Application Features

#### 1. **Standards Fetching** 
- **Official Journal Method**: Direct parsing of EUR-Lex documents with enhanced regex patterns
- **ETSI Portal Method**: Seamless integration with ETSI standards portal
- **Dynamic Discovery**: Automatic detection of new OJ links from EC webpages
- **Real-time Processing**: Live fetching and display of harmonized standards

#### 2. **Professional Display**
- **ETSI-compliant Formatting**: Standards displayed as "EN 301 489-17 V3.2.1 (2023-08)"
- **Hierarchical Layout**: Professional typography matching ETSI portal style
- **Status Indicators**: Current/Withdrawn status with color-coded badges
- **Responsive Design**: Optimized for desktop and mobile devices

#### 3. **Certificate Analysis**
- **PDF Processing**: ISO17025 certificate analysis and standard extraction
- **Standards Comparison**: Compare certificate scope with EU harmonized standards
- **Coverage Reports**: Detailed compliance analysis with percentage coverage
- **Batch Processing**: Compare against multiple directives simultaneously

#### 4. **Search & Export**
- **Advanced Search**: Find specific standards across all directives
- **Export Functions**: Download results in CSV format
- **Real-time Results**: Live search and filtering capabilities
- **Cross-referencing**: Direct links to ETSI portal for detailed specifications

### 🔧 Technical Features

#### 5. **Netlify Functions Backend**
- **Serverless Architecture**: Node.js functions for scalable processing
- **Dynamic OJ Links**: Automatic discovery from EC directive pages
- **Enhanced Parsing**: Comprehensive regex patterns for standard detection
- **Error Handling**: Robust fallback mechanisms and retry logic

#### 6. **Data Management**
- **Caching System**: Optimized performance with intelligent caching
- **Configuration**: External JSON configuration for OJ links
- **API Compatibility**: RESTful endpoints for frontend integration
- **Cross-platform**: Compatible with web, mobile, and desktop applications

## 🚀 Quick Start

### Web Application (Recommended)

1. **Visit the Live Application**: [EU Harmonized Standards Checker](https://eu-harmonized-standards.netlify.app)

2. **Select a Directive**: Choose from RED, EMC, or LVD

3. **Choose Fetch Method**:
   - **Official Journal**: Parse standards directly from EUR-Lex documents
   - **ETSI Portal**: Open ETSI portal in new tab for manual browsing

4. **View Results**: Standards displayed in ETSI-compliant format with versions and descriptions

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
ETSI_API_TIMEOUT=15000
OJ_CACHE_DURATION=86400
```

## 📊 API Endpoints

### Netlify Functions

The application provides RESTful API endpoints:

#### Standards Fetching
```javascript
// Fetch standards for a directive
GET /.netlify/functions/standards?directive=RED

// Response format
{
  "success": true,
  "data": {
    "directive": "RED",
    "directive_name": "Radio Equipment Directive",
    "standards": [
      {
        "number": "EN 301 489-17",
        "full_number": "EN 301 489-17 V3.2.1",
        "version": "V3.2.1",
        "title": "EMC standard for radio equipment",
        "description": "Specific conditions for Broadband Data Transmission Systems",
        "date": "2023-08",
        "type": "Harmonised Standard"
      }
    ],
    "count": 45
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
// Fetch RED standards
const response = await fetch('/.netlify/functions/standards?directive=RED');
const data = await response.json();

if (data.success) {
  console.log(`Found ${data.data.count} standards`);
  data.data.standards.forEach(standard => {
    console.log(`${standard.full_number}: ${standard.description}`);
  });
}
```

#### Node.js Backend
```javascript
const axios = require('axios');

async function fetchStandards(directive) {
  try {
    const response = await axios.get(`/.netlify/functions/standards?directive=${directive}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch standards:', error);
  }
}
```

## 📱 Usage Examples

### Web Interface Output

#### Standards Display (ETSI Format)
```
🔹 RED Standards (45 found)

EN 301 489-17 V3.2.1 (2023-08)
ElectroMagnetic Compatibility (EMC) standard for radio equipment and services; Part 17: Specific conditions for Broadband Data Transmission Systems
🏷️ Harmonised Standard  ✅ Current  🔗 ETSI Portal

EN 301 489-1 V2.2.3 (2019-11)
ElectroMagnetic Compatibility (EMC) standard for radio equipment and services; Part 1: Common technical requirements
🏷️ Harmonised Standard  ✅ Current  🔗 ETSI Portal

EN 300 328 V2.2.2 (2016-11)
Wideband transmission systems; Data transmission equipment operating in the 2,4 GHz ISM band
🏷️ Harmonised Standard  ✅ Current  🔗 ETSI Portal
```

#### Certificate Analysis Report
```
📋 Certificate Information
Certificate Number: 7080.01
Organization: SGS JAPAN INC.
Valid Until: 2025-12-31
Total Standards: 38

📊 Comparison Results - RED
Coverage: 57.9% (22/38 matched)
OJ Standards: 45
ISO Standards: 38

✅ Matched Standards (22)
EN 301 489-17 V3.2.1 ↔ EN 301 489-17 (European Radio)
EN 301 489-1 V2.2.3 ↔ EN 301 489-1 (European Radio)
EN 300 328 V2.2.2 ↔ EN 300 328 (2.4 GHz ISM)
```

## 🛠️ Technical Architecture

### Frontend Stack
- **HTML5**: Semantic markup with accessibility features
- **CSS3**: Modern responsive design with Flexbox/Grid
- **JavaScript ES6+**: Pure vanilla JavaScript, no frameworks
- **Font Awesome**: Professional iconography

### Backend Stack
- **Netlify Functions**: Node.js serverless runtime
- **Axios**: HTTP client for EUR-Lex integration
- **Cheerio**: Server-side HTML parsing and manipulation
- **Dynamic Caching**: Intelligent performance optimization

### Data Sources
- **EUR-Lex**: Official Journal of the European Union
- **EC Directive Pages**: Dynamic OJ link discovery
- **ETSI Portal**: Cross-reference integration
- **Fallback Data**: Cached standards for reliability

### File Structure (Web Application)
```
netlify-pure-webapp/
├── netlify/
│   └── functions/
│       ├── standards.js      # Main standards fetching
│       ├── search.js         # Standards search
│       ├── compare.js        # ISO17025 comparison
│       ├── batch-compare.js  # Batch processing
│       ├── certificate.js   # PDF processing
│       └── directives.js    # Directive metadata
├── static/
│   ├── index.html           # Main application
│   ├── script.js            # Frontend logic
│   └── style.css            # ETSI-compliant styling
├── package.json             # Node.js dependencies
└── README.md               # This documentation
```

### Performance Features
- **CDN Delivery**: Global content distribution via Netlify
- **Lazy Loading**: Progressive content loading
- **Caching Strategy**: Multi-level caching for optimal speed
- **Error Handling**: Graceful degradation and retry logic

## ⚠️ Important Notes

### Usage Guidelines
- **Rate Limiting**: Please use reasonable intervals for bulk requests to EUR-Lex
- **ETSI Portal**: Comply with ETSI's terms of service for portal access
- **PDF Security**: Ensure confidentiality when uploading ISO17025 certificates
- **Browser Compatibility**: Optimized for modern browsers (Chrome, Firefox, Safari, Edge)

### Data Sources
- **EUR-Lex**: Official EU legal database - authoritative source
- **Dynamic Updates**: OJ links automatically discovered from EC webpages
- **Fallback System**: Cached data ensures availability during service interruptions
- **ETSI Integration**: Cross-referencing with official ETSI portal

## 🔧 Development & Contributing

### Local Development Setup

```bash
# Prerequisites
node -v  # Requires Node.js 14+
npm -v   # Requires npm 6+

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
    ec_webpage: 'https://single-market-economy.ec.europa.eu/new-directive',
    fallback_urls: ['https://eur-lex.europa.eu/new-oj-link']
  }
};
```

2. **Add frontend support** in `static/script.js` for new directive handling

3. **Test thoroughly** with real OJ documents to ensure proper parsing

### Regex Pattern Enhancement

Improve standard detection by updating patterns in `parseStandardsFromHtml()`:

```javascript
const patterns = [
  // Add new patterns for different standard formats
  /NEW_PATTERN_HERE/gi,
  // Existing patterns...
];
```

## 🌐 Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Full Support |
| Firefox | 88+ | ✅ Full Support |
| Safari | 14+ | ✅ Full Support |
| Edge | 90+ | ✅ Full Support |
| Mobile | iOS 14+, Android 10+ | ✅ Responsive |

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -am 'Add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Create Pull Request

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/username/Claude_standard_checker/issues)
- **Discussions**: [GitHub Discussions](https://github.com/username/Claude_standard_checker/discussions)
- **Email**: support@eu-harmonized-standards.com

---

**Built with ❤️ for EU compliance professionals**