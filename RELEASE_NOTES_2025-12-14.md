# Release Notes - December 14, 2025

## 🎯 Overview
This release includes major improvements to Excel file fetching with dynamic link extraction, internationalization enhancements, A2LA scope matching fixes, and user interface improvements.

## ✨ Main Features

### Dynamic Excel Link Extraction
- **Implemented dynamic Excel file link extraction from EC directive pages** for RED, EMC, and LVD directives
- Instead of using hardcoded direct download URLs, the application now:
  - Fetches the EC harmonized standards page (e.g., `https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/radio-equipment_en`)
  - Dynamically extracts the Excel file link from the page content
  - Handles redirects to `docsroom` JSON API endpoints and HTML pages
  - Constructs direct Excel download URLs from document IDs when needed
- **Benefits**:
  - Automatically adapts to changes in Excel file URLs on EC pages
  - No need to manually update hardcoded URLs when EC updates their file structure
  - More robust and maintainable solution
- **Technical Implementation**:
  - Added `extractExcelLinkFromECPage()` function to parse HTML and extract Excel links
  - Enhanced `fetchStandardsFromExcel()` to handle `docsroom` redirects:
    - Detects JSON API responses and extracts Excel URLs from JSON structure
    - Detects HTML page redirects and constructs Excel URLs using document ID pattern: `/docsroom/documents/{id}/attachments/1/translations/en/renditions/native`
    - Falls back to HTML parsing if document ID extraction fails
  - Updated `directives.json` to use page URLs instead of direct download links

### OJ Update Notice
- Added a multilingual notice box below the "Fetch Standards" button
- Informs users that the latest OJ information may not be reflected
- Provides direct links to official EC pages for manual verification:
  - **RED**: Radio Equipment Directive page
  - **EMC**: Electromagnetic Compatibility Directive page
  - **LVD**: Low Voltage Directive page
- Fully supports both English and Japanese translations
- Styled with warning colors (yellow/orange) for better visibility

### Default Language Setting
- Changed default language from English to Japanese
- New users will see the interface in Japanese by default
- Language preference is saved in localStorage and persists across sessions
- Fixed language button highlighting to correctly show Japanese as active on initial load

### Scope Matching Note Translation
- Fixed issue where scope matching notes were displayed in Japanese even in English mode
- Added translation system for scope matching notes on the frontend
- Notes are now automatically translated based on the current language setting:
  - English: "⚠️ Comprehensive scope applied (includes 489-17)"
  - Japanese: "⚠️ 包括スコープ適用(489-17含む)"
- All note types are now translated: comprehensive scope, version mismatch, version tolerant, prefix mismatch, and scope applied

## 🐛 Bug Fixes

### A2LA Scope Matching
- Fixed issue where A2LA certificate scope information was not correctly displayed in Fetch results
- **Problem**: Comprehensive scope patterns with spaces (e.g., "EN 301 489-1 / -3 / -7 / -9 / -15 / -17 / -19 / -24 / -51 / -52") were not being matched
- **Solution**: Updated `isComprehensiveScopeMatch()` function to handle both space-separated (" / -") and non-space-separated ("/-") patterns
- Updated regex pattern to match both " / -" and "/-" formats
- Updated part number extraction to handle both "-17" and " / -17" patterns
- Now correctly matches standards like "EN 301 489-17" against comprehensive scope entries

### Language Button Highlighting
- Fixed issue where English button was highlighted even when default language was Japanese
- **Problem**: HTML had hardcoded `active` class on English button, and `updateLanguageButtons()` was not called during initialization
- **Solution**: 
  - Removed hardcoded `active` class from HTML
  - Added `updateLanguageButtons()` call in `initializeApp()` function
  - Now correctly highlights Japanese button on initial load when default language is Japanese

### Configuration Management
- Modified `getDirectiveConfig()` function to always reload `directives.json` on each request
- Eliminates the need to restart the Netlify Functions server when updating directive URLs
- Ensures the latest configuration is always used for all directives (EMC, RED, LVD)

## 📝 Technical Details

### Files Modified

#### `netlify/functions/standards.js`
- Added `extractExcelLinkFromECPage()` function to dynamically extract Excel links from EC pages
  - Handles both HTML page parsing and JSON API responses
  - Supports `docsroom` document endpoints
  - Extracts Excel links from various HTML patterns
- Enhanced `fetchStandardsFromExcel()` function:
  - Detects page URLs vs. direct download URLs
  - Handles redirects to `docsroom` HTML pages
  - Constructs Excel download URLs from document IDs
  - Performs secondary fetch to get actual Excel binary when needed
  - Extracts filenames from `Content-Disposition` headers
- Modified `getDirectiveConfig()` to always reload directives data
- Improved error handling and logging

#### `static/api/directives.json`
- Updated `excel_url` for all directives to use page URLs instead of direct download links:
  - **RED**: `https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/radio-equipment_en`
  - **EMC**: `https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/electromagnetic-compatibility-emc_en#:~:text=Summary%20list%20as%20xls%20file`
  - **LVD**: `https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/low-voltage-lvd_en`

#### `netlify/functions/scope-matcher.js`
- Updated `isComprehensiveScopeMatch()` function to handle space-separated comprehensive scope patterns
- Updated regex pattern: `/\s*\/\s*-\d+/` to match both " / -" and "/-" formats
- Updated part number extraction to handle both "-17" and " / -17" patterns

#### `static/index.html`
- Added notice box HTML structure with i18n support
- Removed hardcoded `active` class from language buttons

#### `static/script.js`
- Added i18n translations for notice box (English and Japanese)
- Added `translateScopeNote()` function for translating scope matching notes
- Added translation keys for all scope matching note types
- Changed default language from English to Japanese (`currentLanguage = 'ja'`)
- Added `updateLanguageButtons()` call in `initializeApp()` function
- Enhanced language switching functionality

#### `static/style.css`
- Added styling for notice box with warning colors
- Responsive design for notice links
- Updated color scheme to orange-based theme (from previous release)

## 🌐 Internationalization

### New Translation Keys
- `standards.note_oj_update`: Main notice text
- `standards.note_red_link`: RED directive label
- `standards.note_emc_link`: EMC directive label
- `standards.note_lvd_link`: LVD directive label
- `scope.note.comprehensive`: Comprehensive scope applied message
- `scope.note.version_mismatch`: Version mismatch message
- `scope.note.version_tolerant`: Version tolerant message
- `scope.note.scope_applied`: Scope applied message
- `scope.note.prefix_mismatch`: Prefix mismatch message

## 🔗 Related Links

- RED Directive: https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/radio-equipment_en
- EMC Directive: https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/electromagnetic-compatibility-emc_en
- LVD Directive: https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/low-voltage-lvd_en

## 📦 Change History

### Main Commits
- `41d08f7`: Fix: Always reload directives.json and update EMC/LVD URLs
- `de57d73`: Add OJ update notice with manual verification links
- `45f08fb`: Fix: A2LA scope matching for comprehensive scope patterns with spaces
- `42f3bb7`: Add translation support for scope matching notes and set Japanese as default
- `4261213`: Add Japanese version of release notes and update commit references
- `2cf9242`: Consolidate all updates into December 14, 2025 release notes

### Follow-up Commits
- `f58a5c2`: Remove debug logs after successful EMC/LVD fix verification

## 🚀 Deployment Notes

- No database migrations required
- No environment variable changes
- Configuration changes are backward compatible
- All changes are immediately effective after deployment
- Excel file URLs will be dynamically extracted on first fetch after deployment

## 👥 Impact

- **Users**: 
  - Excel files for all directives (EMC, LVD, RED) are now automatically fetched from the latest EC pages
  - Can see accurate A2LA certificate scope information in Fetch results
  - Comprehensive scope matching now works correctly for standards like EN 301 489-17
  - Scope matching notes are now properly translated based on language preference
  - Interface defaults to Japanese for better accessibility
  - Language button correctly highlights the active language on initial load
  - Informed about potential OJ update delays with manual verification links
- **Developers**: 
  - Can update directive URLs without restarting the server
  - Dynamic link extraction reduces maintenance burden
  - No need to manually update Excel URLs when EC changes their file structure
- **Administrators**: Users are now informed about potential OJ update delays and provided with manual verification links

---

**Release Date**: December 14, 2025  
**Version**: Based on commits `41d08f7`, `de57d73`, `45f08fb`, `42f3bb7`, `4261213`, `2cf9242`, and `f58a5c2`
