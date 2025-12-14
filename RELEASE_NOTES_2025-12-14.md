# Release Notes - December 14, 2025

## 🎯 Overview
This release includes important improvements to directive URL handling, configuration reloading, and user notifications for OJ (Official Journal) updates.

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

## 🐛 Bug Fixes

### Excel File Download Issues
- Fixed issue where EMC and LVD directives failed to download Excel files due to redirect handling
- The redirecting URLs (37904, 38784) were causing 500 errors on the redirected destination
- Solution: Use direct URLs (51315, 62995) that bypass the problematic redirect chain

### Configuration Caching
- Fixed issue where changes to `directives.json` required server restart to take effect
- Now automatically reloads configuration on every request, ensuring immediate updates

## 📝 Technical Details

### Files Modified
- `netlify/functions/standards.js`
  - Modified `getDirectiveConfig()` to always reload directives data
  - Added debug logging for configuration loading
  - Enhanced error handling for directive configuration

- `static/api/directives.json`
  - Updated `excel_url` for EMC directive: `51315/attachments/1/translations/en/renditions/native`
  - Updated `excel_url` for LVD directive: `62995/attachments/1/translations/en/renditions/native`

- `static/index.html`
  - Added notice box HTML structure with i18n support

- `static/script.js`
  - Added i18n translations for notice box (English and Japanese)
  - Removed debug logging

- `static/style.css`
  - Added styling for notice box with warning colors
  - Responsive design for notice links

## 🌐 Internationalization

### New Translation Keys
- `standards.note_oj_update`: Main notice text
- `standards.note_red_link`: RED directive label
- `standards.note_emc_link`: EMC directive label
- `standards.note_lvd_link`: LVD directive label

## 🔗 Related Links

- RED Directive: https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/radio-equipment_en
- EMC Directive: https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/electromagnetic-compatibility-emc_en
- LVD Directive: https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/low-voltage-lvd_en

## 📦 Commits

- `41d08f7`: Fix: Always reload directives.json and update EMC/LVD URLs
- `de57d73`: Add OJ update notice with manual verification links

## 🚀 Deployment Notes

- No database migrations required
- No environment variable changes
- Configuration changes are backward compatible
- All changes are immediately effective after deployment

## 👥 Impact

- **Users**: Can now reliably download Excel files for all directives (EMC, LVD, RED)
- **Developers**: Can update directive URLs without restarting the server
- **Administrators**: Users are now informed about potential OJ update delays and provided with manual verification links

---

**Release Date**: December 14, 2025  
**Version**: Based on commits `41d08f7` and `de57d73`
