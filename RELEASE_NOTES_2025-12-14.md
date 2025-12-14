# Release Notes - December 14, 2025

## 🎯 Overview
This release includes important improvements to directive URL handling, configuration reloading, user notifications for OJ (Official Journal) updates, A2LA scope matching fixes, internationalization enhancements, and default language settings.

## ✨ New Features

### OJ Update Notice
- Added a notice box below the "Fetch Standards" button to inform users that the latest OJ information may not be reflected
- Includes direct links to official EC pages for manual verification:
  - **RED**: Radio Equipment Directive page
  - **EMC**: Electromagnetic Compatibility Directive page
  - **LVD**: Low Voltage Directive page
- Fully supports both English and Japanese translations
- Styled with warning colors (yellow/orange) for better visibility

## 🔧 Improvements

### Directive Configuration Management
- **Dynamic Configuration Reloading**: Modified `getDirectiveConfig()` function to always reload `directives.json` on each request
  - Eliminates the need to restart the Netlify Functions server when updating directive URLs
  - Ensures the latest configuration is always used for all directives (EMC, RED, LVD)
  - Improves development workflow and reduces deployment friction

### URL Updates
- **EMC Directive**: Updated Excel URL from redirecting URL (37904) to direct URL (51315)
  - Resolves 500 Internal Server Error that occurred when following redirects
  - Ensures reliable Excel file downloads
  
- **LVD Directive**: Updated Excel URL from redirecting URL (38784) to direct URL (62995)
  - Resolves 500 Internal Server Error that occurred when following redirects
  - Ensures reliable Excel file downloads

- **RED Directive**: URL already configured correctly (no changes needed)
  - Uses direct download URL: `https://single-market-economy.ec.europa.eu/document/download/...`

### Color Scheme Redesign
- Updated entire application to use orange-based color theme
- Inspired by SGS Japan website design
- Improved visual consistency and modern appearance
- All UI elements updated: headers, buttons, tabs, form elements, badges, and more

## 🐛 Bug Fixes

### Excel File Download Issues
- Fixed issue where EMC and LVD directives failed to download Excel files due to redirect handling
- The redirecting URLs (37904, 38784) were causing 500 errors on the redirected destination
- Solution: Use direct URLs (51315, 62995) that bypass the problematic redirect chain

### Configuration Caching
- Fixed issue where changes to `directives.json` required server restart to take effect
- Now automatically reloads configuration on every request, ensuring immediate updates

### A2LA Scope Matching
- Fixed issue where A2LA certificate scope information was not correctly displayed in Fetch results
- Problem: Comprehensive scope patterns with spaces (e.g., "EN 301 489-1 / -3 / -7 / -9 / -15 / -17 / -19 / -24 / -51 / -52") were not being matched
- Solution: Updated `isComprehensiveScopeMatch()` function to handle both space-separated (" / -") and non-space-separated ("/-") patterns
- Updated regex pattern: `/(\d+(?:\s+\d+)*)-(\d+)(?:\s*\/\s*-\d+)+/` to match both " / -" and "/-" formats
- Updated part number extraction to handle both "-17" and " / -17" patterns
- Now correctly matches standards like "EN 301 489-17" against comprehensive scope entries
- Users can now see A2LA scope information (e.g., "A2LA 🟢 ⚠️ 包括スコープ適用(489-17含む)") in the Fetch results

### Scope Matching Note Translation
- Fixed issue where scope matching notes were displayed in Japanese even in English mode
- Problem: Notes like "⚠️ 包括スコープ適用(489-17含む)" were hardcoded in Japanese in the backend
- Solution: Added translation system for scope matching notes on the frontend
- Notes are now automatically translated based on the current language setting:
  - English: "⚠️ Comprehensive scope applied (includes 489-17)"
  - Japanese: "⚠️ 包括スコープ適用(489-17含む)"
- All note types are now translated: comprehensive scope, version mismatch, version tolerant, prefix mismatch, and scope applied

### Default Language Setting
- Changed default language from English to Japanese
- New users will see the interface in Japanese by default
- Language preference is still saved in localStorage and persists across sessions
- Users can switch languages using the language toggle buttons

## 📝 Technical Details

### Files Modified
- `netlify/functions/standards.js`
  - Modified `getDirectiveConfig()` to always reload directives data
  - Added debug logging for configuration loading
  - Enhanced error handling for directive configuration

- `netlify/functions/scope-matcher.js`
  - Updated `isComprehensiveScopeMatch()` function to handle space-separated comprehensive scope patterns
  - Updated regex pattern to match both " / -" and "/-" formats
  - Updated part number extraction to handle both "-17" and " / -17" patterns
  - Now correctly matches standards against A2LA comprehensive scope entries

- `static/api/directives.json`
  - Updated `excel_url` for EMC directive: `51315/attachments/1/translations/en/renditions/native`
  - Updated `excel_url` for LVD directive: `62995/attachments/1/translations/en/renditions/native`

- `static/index.html`
  - Added notice box HTML structure with i18n support

- `static/script.js`
  - Added i18n translations for notice box (English and Japanese)
  - Added translation system for scope matching notes (`translateScopeNote()` function)
  - Added translation keys for all scope matching note types
  - Changed default language from English to Japanese
  - Removed debug logging

- `static/style.css`
  - Added styling for notice box with warning colors
  - Responsive design for notice links
  - Updated color scheme to orange-based theme
  - Updated all UI elements with new orange color variables

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

## 📦 Commits

- `41d08f7`: Fix: Always reload directives.json and update EMC/LVD URLs
- `de57d73`: Add OJ update notice with manual verification links
- `45f08fb`: Fix A2LA scope matching for comprehensive scope patterns with spaces
- `42f3bb7`: Add translation support for scope matching notes and set Japanese as default language
- `4261213`: Add Japanese version of release notes and update commit references

## 🚀 Deployment Notes

- No database migrations required
- No environment variable changes
- Configuration changes are backward compatible
- All changes are immediately effective after deployment

## 👥 Impact

- **Users**: 
  - Can now reliably download Excel files for all directives (EMC, LVD, RED)
  - Can see accurate A2LA certificate scope information in Fetch results
  - Comprehensive scope matching now works correctly for standards like EN 301 489-17
  - Scope matching notes are now properly translated based on language preference
  - Interface defaults to Japanese for better accessibility
  - Enjoy a modern orange-based color scheme throughout the application
- **Developers**: Can update directive URLs without restarting the server
- **Administrators**: Users are now informed about potential OJ update delays and provided with manual verification links

---

**Release Date**: December 14, 2025  
**Version**: Based on commits `41d08f7`, `de57d73`, `45f08fb`, `42f3bb7`, and `4261213`

---

**日本語版**: [RELEASE_NOTES_2025-12-14_ja.md](RELEASE_NOTES_2025-12-14_ja.md)
