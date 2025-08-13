# Certificate Documents

This directory contains PDF files and documentation for ISO17025 certificates.

## A2LA Certificates
- Place A2LA certificate PDFs with naming convention: `a2la-[certificate-number].pdf`
- Example: `a2la-2022-01.pdf`

## JAB Certificates  
- Place JAB certificate PDFs with naming convention: `jab-[certificate-number].pdf`
- Example: `jab-rtl02770.pdf`

## Usage
These files are accessible via:
- Direct URL: `https://eu-harmonized-standards.netlify.app/certificates/[filename].pdf`
- API endpoint: `/.netlify/functions/certificate-pdf?cert_type=[a2la|jab]&cert_number=[number]`

## File Size Limits
- Netlify has a 100MB limit for static files
- Keep PDF files under 10MB for optimal performance
- Consider compression for large certificate documents