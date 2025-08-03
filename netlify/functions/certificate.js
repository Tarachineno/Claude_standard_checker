// Certificate processing with pdf-parse only (step 1)
const pdf = require('pdf-parse');
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  console.log('=== MINIMAL CERTIFICATE FUNCTION ===');
  console.log('HTTP Method:', event.httpMethod);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed'
      })
    };
  }

  try {
    // Check if body exists
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'No request body provided'
        })
      };
    }

    console.log('Body length:', event.body.length);

    // Parse JSON request
    let requestData;
    try {
      requestData = JSON.parse(event.body);
      console.log('JSON parsed successfully');
    } catch (parseError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Invalid JSON: ${parseError.message}`
        })
      };
    }

    // Validate request
    if (!requestData.fileData || !requestData.fileName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing fileData or fileName'
        })
      };
    }

    console.log('File name:', requestData.fileName);
    console.log('File data length:', requestData.fileData.length);

    // Try to decode base64 data
    let fileBuffer;
    try {
      fileBuffer = Buffer.from(requestData.fileData, 'base64');
      console.log('Base64 decoded, buffer size:', fileBuffer.length);
    } catch (decodeError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Base64 decode failed: ${decodeError.message}`
        })
      };
    }

    // Parse PDF content with pdf-parse
    let pdfData, text;
    try {
      console.log('Parsing PDF with pdf-parse...');
      pdfData = await pdf(fileBuffer);
      text = pdfData.text;
      console.log('PDF text extracted, length:', text.length);
      console.log('PDF pages:', pdfData.numpages);
    } catch (pdfError) {
      console.error('PDF parsing failed:', pdfError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: `PDF processing failed: ${pdfError.message}`
        })
      };
    }

    // Check if PDF appears to be image-based (very little text extracted)
    if (text.length < 100 || text.trim().split(' ').length < 20) {
      console.log('PDF appears to be image-based');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            certificate_info: {
              certificate_number: 'Image-based PDF detected',
              organization: 'OCR Required (Not Available)',
              valid_until: 'Unknown',
              accreditation_body: 'Unknown',
              revision_date: 'Unknown'
            },
            test_standards: [],
            categories: {},
            total_standards: 0,
            extraction_date: new Date().toISOString(),
            pdf_source: requestData.fileName,
            certificate_type: 'Image_Based_PDF',
            note: `This PDF appears to be scanned/image-based (${text.length} characters extracted). OCR functionality is not available in this environment.`
          }
        })
      };
    }

    // Process text-based PDF
    console.log('Processing text-based PDF');
    const certificateData = extractBasicCertificateData(text, requestData.fileName);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: certificateData
      })
    };

  } catch (error) {
    console.error('Certificate processing error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: `Processing failed: ${error.message}`,
        stack: error.stack
      })
    };
  }
};

// Extract basic certificate data and test standards from PDF text
function extractBasicCertificateData(text, filename) {
  console.log('Extracting certificate data from:', filename);

  // Extract certificate information
  const certificateInfo = extractCertificateInfo(text, filename);
  
  // Extract test standards from the text
  const testStandards = extractTestStandards(text);
  
  // Categorize standards
  const categories = categorizeStandards(testStandards);
  
  return {
    certificate_info: certificateInfo,
    test_standards: testStandards,
    categories: categories,
    total_standards: testStandards.length,
    extraction_date: new Date().toISOString(),
    pdf_source: filename || 'uploaded_certificate.pdf',
    certificate_type: 'Text_Based_PDF'
  };
}

// Extract certificate information from PDF text
function extractCertificateInfo(text, filename) {
  const info = {
    certificate_number: 'Unknown',
    organization: 'Unknown',
    valid_until: 'Unknown',
    accreditation_body: 'Unknown',
    revision_date: 'Unknown'
  };

  // Extract certificate number from filename or text
  const certNumFromFilename = filename?.match(/(\d{4}-\d{2})/);
  if (certNumFromFilename) {
    info.certificate_number = certNumFromFilename[1];
  }

  // Extract organization (look for common patterns)
  const orgPatterns = [
    /Certificate No\.\s*[:\-]?\s*([^\n\r]+)/i,
    /Laboratory[\s:]+([^\n\r]+)/i,
    /Organization[\s:]+([^\n\r]+)/i
  ];
  
  for (const pattern of orgPatterns) {
    const match = text.match(pattern);
    if (match && match[1]?.trim()) {
      info.organization = match[1].trim();
      break;
    }
  }

  // Extract validity date
  const validityPatterns = [
    /valid until[\s:]+([\d]{4}[.\-/][\d]{1,2}[.\-/][\d]{1,2})/i,
    /expires?[\s:]+([\d]{4}[.\-/][\d]{1,2}[.\-/][\d]{1,2})/i,
    /([\d]{4}[.\-/][\d]{1,2}[.\-/][\d]{1,2})/g
  ];

  for (const pattern of validityPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      // Get the last date found (usually the expiration date)
      const dates = matches.map(m => m.match(/[\d]{4}[.\-/][\d]{1,2}[.\-/][\d]{1,2}/));
      if (dates.length > 0) {
        info.valid_until = dates[dates.length - 1][0];
        break;
      }
    }
  }

  // Look for A2LA in the text
  if (text.includes('A2LA')) {
    info.accreditation_body = 'A2LA';
  }

  return info;
}

// Extract test standards from PDF text
function extractTestStandards(text) {
  const standards = [];
  const standardsSet = new Set(); // To avoid duplicates

  // Enhanced patterns for various standard formats
  const patterns = [
    // Standard format patterns
    /\b(ANSI\s+C\d+\.\d+:\d{4})\b/gi,
    /\b(CFR\s+47\s+FCC\s+Part\s+\d+[A-Z]?)\b/gi,
    /\b(FCC\s+Part\s+\d+[A-Z]?)\b/gi,
    /\b(FCC\s+Parts?\s+\d+[A-Z]?(?:\s*,\s*\d+[A-Z]?)*)\b/gi,
    /\b(ETSI\s+EN\s+\d+\s+\d+(?:\-\d+)*(?:\-\d+)*)\b/gi,
    /\b(EN\s+\d+\s+\d+(?:\-\d+)*(?:\-\d+)*)\b/gi,
    /\b(EN\s+\d{5,6}(?:\-\d+)*)\b/gi,
    /\b(IEC\s+\d{5,6}(?:\-\d+)*(?:\-\d+)*)\b/gi,
    /\b(CISPR\s+\d+)\b/gi,
    /\b(RSS\-\w+)\b/gi,
    /\b(ICES\-\w+)\b/gi
  ];

  // Extract standards using patterns
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const cleanMatch = match.trim();
        if (cleanMatch && !standardsSet.has(cleanMatch)) {
          standardsSet.add(cleanMatch);
          standards.push({
            standard_number: cleanMatch,
            version: extractVersion(cleanMatch),
            category: categorizeStandard(cleanMatch),
            description: generateDescription(cleanMatch)
          });
        }
      });
    }
  }

  console.log(`Extracted ${standards.length} unique standards`);
  return standards;
}

// Extract version from standard number
function extractVersion(standardText) {
  const versionMatch = standardText.match(/:(\d{4})/);
  if (versionMatch) {
    return versionMatch[1];
  }
  
  const vMatch = standardText.match(/[Vv](\d+\.\d+(?:\.\d+)?)/);
  if (vMatch) {
    return `V${vMatch[1]}`;
  }
  
  return '';
}

// Categorize standards by type
function categorizeStandard(standardText) {
  const std = standardText.toUpperCase();
  
  if (std.includes('FCC') || std.includes('CFR')) {
    return 'United States Radio';
  }
  if (std.includes('RSS') || std.includes('ICES')) {
    return 'Canada Radio';
  }
  if (std.includes('ETSI') || std.includes('EN 30')) {
    return 'European Radio';
  }
  if (std.includes('CISPR') || std.includes('EN 55')) {
    return 'Emissions Standards';
  }
  if (std.includes('61000')) {
    return 'EMC Immunity Standards';
  }
  if (std.includes('C63')) {
    return 'ANSI Measurement Standards';
  }
  
  return 'Other Standards';
}

// Generate description for standards
function generateDescription(standardText) {
  const descriptions = {
    'ANSI C63.4': 'American National Standard for Methods of Measurement',
    'FCC Part 15B': 'Unintentional Radiators',
    'FCC Part 15C': 'Intentional Radiators',
    'FCC Part 15E': 'Unlicensed National Information Infrastructure (U-NII)',
    'FCC Part 15F': 'Ultra-Wideband Operation',
    'FCC Part 18': 'Industrial, Scientific, and Medical Equipment',
    'CISPR 11': 'Industrial, scientific and medical equipment',
    'EN 55032': 'Electromagnetic compatibility of multimedia equipment',
    'IEC 61000-4-2': 'Electrostatic discharge immunity test',
    'IEC 61000-4-3': 'Radiated electromagnetic field immunity test'
  };
  
  for (const [key, desc] of Object.entries(descriptions)) {
    if (standardText.includes(key)) {
      return desc;
    }
  }
  
  return standardText;
}

// Categorize extracted standards into groups
function categorizeStandards(testStandards) {
  const categories = {};
  
  testStandards.forEach(standard => {
    const category = standard.category;
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(standard.standard_number);
  });
  
  return categories;
}