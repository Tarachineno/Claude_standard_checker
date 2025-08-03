// Upload and process ISO17025 certificate - Netlify Function
const pdf = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const pdf2pic = require('pdf2pic');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

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
    // Parse multipart form data
    const { file, metadata } = await parseMultipartFormData(event);
    
    if (!file || !file.buffer) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'No PDF file provided'
        })
      };
    }

    console.log('Processing PDF file:', file.filename || 'unknown.pdf');

    // Parse PDF content
    const pdfData = await pdf(file.buffer);
    let text = pdfData.text;

    console.log('PDF text extracted, length:', text.length);

    // Check if PDF appears to be image-based (very little text extracted)
    if (text.length < 100 || text.trim().split(' ').length < 20) {
      console.log('PDF appears to be image-based, attempting OCR...');
      try {
        text = await performOCR(file.buffer, file.filename);
        console.log('OCR text extracted, length:', text.length);
      } catch (ocrError) {
        console.error('OCR failed, returning with limited text:', ocrError.message);
        // Return with a special indicator for image-based PDFs that need OCR
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: {
              certificate_info: {
                certificate_number: 'Image-based PDF detected',
                organization: 'OCR Required',
                valid_until: 'Unknown',
                accreditation_body: 'Unknown',
                revision_date: 'Unknown'
              },
              test_standards: [],
              categories: {},
              total_standards: 0,
              extraction_date: new Date().toISOString(),
              pdf_source: file.filename || 'uploaded_certificate.pdf',
              certificate_type: 'Image_Based_PDF',
              note: 'This PDF appears to be scanned/image-based. OCR functionality is implemented but requires additional server configuration (ImageMagick/GraphicsMagick). Please ensure the PDF contains machine-readable text for optimal extraction.'
            }
          })
        };
      }
    }

    // Extract certificate information and test standards
    const certificateData = await extractCertificateData(text, file.filename);

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
        error: `Certificate processing failed: ${error.message}`
      })
    };
  }
};

// Perform OCR on image-based PDF
async function performOCR(pdfBuffer, filename) {
  try {
    console.log('Starting OCR process for:', filename);
    
    // Convert PDF to images
    const convert = pdf2pic.fromBuffer(pdfBuffer, {
      density: 200,           // High DPI for better OCR
      saveFilename: "page",
      savePath: "/tmp",
      format: "png",
      width: 2048,            // High resolution for better text recognition
      height: 2048
    });

    // Convert all pages to images
    const imageResults = await convert.bulk(-1, {
      responseType: "buffer"
    });

    console.log(`Converted ${imageResults.length} pages to images`);

    // Create Tesseract worker
    const worker = await createWorker(['eng', 'jpn'], 1, {
      logger: m => console.log('Tesseract:', m)
    });

    let combinedText = '';

    // Process each page with OCR
    for (let i = 0; i < imageResults.length; i++) {
      console.log(`Processing page ${i + 1}/${imageResults.length} with OCR...`);
      
      const { data: { text } } = await worker.recognize(imageResults[i].buffer, {
        tessedit_pageseg_mode: '1', // Automatic page segmentation with OSD
        tessedit_ocr_engine_mode: '1', // Neural nets LSTM engine only
        preserve_interword_spaces: '1'
      });

      combinedText += `\n--- Page ${i + 1} ---\n${text}\n`;
    }

    await worker.terminate();
    
    console.log('OCR completed successfully');
    return combinedText;

  } catch (error) {
    console.error('OCR processing failed:', error);
    throw new Error(`OCR processing failed: ${error.message}`);
  }
}

// Parse multipart form data from Netlify Functions
async function parseMultipartFormData(event) {
  const boundary = event.headers['content-type']?.split('boundary=')[1];
  if (!boundary) {
    throw new Error('No boundary found in content-type header');
  }

  const body = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
  const parts = body.toString('binary').split(`--${boundary}`);
  
  let file = null;
  
  for (const part of parts) {
    if (part.includes('Content-Disposition: form-data')) {
      const headers = part.split('\r\n\r\n')[0];
      const content = part.split('\r\n\r\n').slice(1).join('\r\n\r\n');
      
      if (headers.includes('filename=')) {
        const filename = headers.match(/filename="([^"]*)"/) ? headers.match(/filename="([^"]*)"/)[1] : 'unknown.pdf';
        file = {
          filename: filename,
          buffer: Buffer.from(content, 'binary')
        };
      }
    }
  }
  
  return { file };
}

// Extract certificate data and test standards from PDF text
async function extractCertificateData(text, filename) {
  console.log('Extracting certificate data from:', filename);

  // Extract certificate information
  const certificateInfo = extractCertificateInfo(text, filename);
  
  // Check if this is a JAB certificate with multiple facilities
  const isJABCertificate = text.includes('JAB') || text.includes('Japan Accreditation Board') || text.includes('【施設');
  
  if (isJABCertificate) {
    // Extract facilities and their standards
    const facilities = extractJABFacilities(text);
    const allStandards = [];
    
    facilities.forEach(facility => {
      allStandards.push(...facility.standards);
    });
    
    const categories = categorizeStandards(allStandards);
    
    return {
      certificate_info: certificateInfo,
      test_standards: allStandards,
      categories: categories,
      facilities: facilities,
      total_standards: allStandards.length,
      extraction_date: new Date().toISOString(),
      pdf_source: filename || 'uploaded_certificate.pdf',
      certificate_type: 'JAB_Facilities'
    };
  } else {
    // Extract test standards from the text (regular processing)
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
      certificate_type: 'Standard'
    };
  }
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
    /Laboratory[:\s]+([^\n\r]+)/i,
    /Organization[:\s]+([^\n\r]+)/i
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
    /valid until[:\s]+(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/i,
    /expires?[:\s]+(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/i,
    /(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/g
  ];

  for (const pattern of validityPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      // Get the last date found (usually the expiration date)
      const dates = matches.map(m => m.match(/\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/));
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
    /\b(KS\s+C\s+\d+(?:\-\d+)*)\b/gi,
    /\b(AS\/NZS\s+\d+)\b/gi,
    /\b(ISO\s+\d+(?:\-\d+)*)\b/gi,
    /\b(RSS\-\w+)\b/gi,
    /\b(ICES\-\w+)\b/gi,
    /\b(SEMI\s+[A-Z]\d+)\b/gi,
    /\b(Wi-Fi\s+CERTIFIED\s+\w+(?:\s+\w+)*)\b/gi,
    /\b(MP\-\d+)\b/gi,
    /\b(UNII\-MP)\b/gi,
    /\b(WMM\s+Power\s+Save)\b/gi,
    /\b(Protected\s+Management\s+Frames)\b/gi,
    /\b(Miracast)\b/gi,
    /\b(Wi-Fi\s+Direct)\b/gi,
    /\b(Wi-Fi\s+Protected\s+Setup)\b/gi
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

  // Also look for version-specific patterns
  const versionPatterns = [
    /\b(EN\s+\d+\s+\d+(?:\-\d+)*):(\d{4})\b/gi,
    /\b(IEC\s+\d+(?:\-\d+)*):(\d{4})\b/gi
  ];

  for (const pattern of versionPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const standardNum = match[1].trim();
      const year = match[2];
      const fullStandard = `${standardNum}:${year}`;
      
      if (!standardsSet.has(fullStandard)) {
        standardsSet.add(fullStandard);
        standards.push({
          standard_number: fullStandard,
          version: year,
          category: categorizeStandard(standardNum),
          description: generateDescription(standardNum)
        });
      }
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
  if (std.includes('AS/NZS')) {
    return 'Australia / New Zealand Radio';
  }
  if (std.includes('CISPR') || std.includes('EN 55')) {
    return 'Emissions for Ports';
  }
  if (std.includes('61000-3-2')) {
    return 'Harmonic Current Emissions';
  }
  if (std.includes('61000-3-3') || std.includes('61000-3-11')) {
    return 'Voltage Fluctuations & Flicker';
  }
  if (std.includes('61000-4-2')) {
    return 'Electrostatic Discharge (ESD)';
  }
  if (std.includes('61000-4-3')) {
    return 'RF Radiated EM Field Immunity';
  }
  if (std.includes('61000-4-4')) {
    return 'Electrical Fast/Transient Burst (EFT)';
  }
  if (std.includes('61000-4-5')) {
    return 'Surge';
  }
  if (std.includes('61000-4-6')) {
    return 'Conducted Immunity';
  }
  if (std.includes('7637')) {
    return 'Transients & Surges (Vehicle)';
  }
  if (std.includes('61000-4-8')) {
    return 'Magnetic Field Immunity';
  }
  if (std.includes('61000-4-11') || std.includes('61000-4-34')) {
    return 'Voltage Dips/Interruptions/Variations';
  }
  if (std.includes('SEMI F47')) {
    return 'Semiconductor Equipment Voltage Sag Immunity';
  }
  if (std.includes('61000-6-2')) {
    return 'Generic Immunity – Industrial Environments';
  }
  if (std.includes('61000-6-4')) {
    return 'Radiated & Conducted';
  }
  if (std.includes('WI-FI')) {
    return 'Wi-Fi Devices Interoperability';
  }
  if (std.includes('C63.4')) {
    return 'Unintentional Radiators (FCC Part 15B)';
  }
  if (std.includes('C63.10')) {
    return 'Intentional Radiators (FCC Part 15C)';
  }
  if (std.includes('C63.26')) {
    return 'Microwave & Millimeter Radio Services';
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
    'EN 55011': 'Industrial, scientific and medical equipment',
    'EN 55032': 'Electromagnetic compatibility of multimedia equipment',
    'IEC 61000-4-2': 'Electrostatic discharge immunity test',
    'IEC 61000-4-3': 'Radiated electromagnetic field immunity test',
    'Wi-Fi CERTIFIED': 'Wi-Fi Alliance certification program'
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

// Extract JAB facilities and their standards
function extractJABFacilities(text) {
  const facilities = [];
  
  // Pattern to match facility sections
  const facilityPattern = /【施設(\d+)】([^【]+?)(?=【施設|$)/gs;
  
  let facilityMatch;
  while ((facilityMatch = facilityPattern.exec(text)) !== null) {
    const facilityNumber = facilityMatch[1];
    const facilityContent = facilityMatch[2];
    
    // Extract facility name and location
    const facilityNameMatch = facilityContent.match(/^([^（]+?)（([^）]+)）/);
    const facilityName = facilityNameMatch ? facilityNameMatch[1].trim() : `Facility ${facilityNumber}`;
    const facilityLocation = facilityNameMatch ? facilityNameMatch[2].trim() : 'Unknown location';
    
    // Extract standards from the facility content
    const facilityStandards = extractJABFacilityStandards(facilityContent);
    
    facilities.push({
      facility_number: facilityNumber,
      name: facilityName,
      location: facilityLocation,
      standards: facilityStandards,
      standards_count: facilityStandards.length
    });
  }
  
  console.log(`Extracted ${facilities.length} JAB facilities`);
  return facilities;
}

// Extract standards from JAB facility content
function extractJABFacilityStandards(facilityText) {
  const standards = [];
  const standardsSet = new Set();
  
  // Enhanced patterns for JAB standards including Japanese standards
  const patterns = [
    // EN standards
    /\b(EN\s+\d{5,6}(?:\-\d+)*(?::\d{4})?(?:\s*\([^)]+\))?)\b/gi,
    // IEC standards  
    /\b(IEC\s+\d{5,6}(?:\-\d+)*(?::\d{4})?(?:\s*\([^)]+\))?)\b/gi,
    // ISO standards
    /\b(ISO\s+\d{5,6}(?:\-\d+)*(?::\d{4})?(?:\s*\([^)]+\))?)\b/gi,
    // JIS standards
    /\b(JIS\s+[A-Z]\s*\d{4,6}(?:\-\d+)*(?::\d{4})?)\b/gi,
    // CISPR standards
    /\b(CISPR\s*\d{1,3}(?:\s*\([^)]+\))?)\b/gi,
    // VCCI standards
    /\b(VCCI[\s\-]?[A-Z\d\-]+)\b/gi,
    // ETSI standards
    /\b(ETSI\s+EN\s+\d+\s+\d+(?:\-\d+)*)\b/gi
  ];

  // Extract standards using patterns
  for (const pattern of patterns) {
    const matches = facilityText.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const cleanMatch = match.trim();
        if (cleanMatch && !standardsSet.has(cleanMatch)) {
          standardsSet.add(cleanMatch);
          standards.push({
            standard_number: cleanMatch,
            version: extractVersion(cleanMatch),
            category: categorizeJABStandard(cleanMatch),
            description: generateDescription(cleanMatch)
          });
        }
      });
    }
  }

  // Also extract test method classifications
  const testMethodPattern = /M\d+(?:\.\d+)*(?:\s+[^M\n\r]*)/g;
  const testMethods = facilityText.match(testMethodPattern);
  
  if (testMethods) {
    testMethods.forEach(method => {
      const cleanMethod = method.trim();
      if (cleanMethod && !standardsSet.has(cleanMethod)) {
        standardsSet.add(cleanMethod);
        standards.push({
          standard_number: cleanMethod,
          version: '',
          category: 'Test Method Classification',
          description: cleanMethod
        });
      }
    });
  }

  console.log(`Extracted ${standards.length} standards from facility`);
  return standards;
}

// Categorize JAB standards
function categorizeJABStandard(standardText) {
  const std = standardText.toUpperCase();
  
  if (std.includes('M21.4.1') || std.includes('CONTINUOUS DISTURBANCE')) {
    return 'Continuous Disturbance Tests';
  }
  if (std.includes('M21.4.2') || std.includes('ON BOARD VEHICLE')) {
    return 'Vehicle EMC Tests';
  }
  if (std.includes('M21.4.4') || std.includes('CONDUCTED EMISSION')) {
    return 'Conducted Emission Tests';
  }
  if (std.includes('M21.4.10') || std.includes('HARMONIC CURRENT')) {
    return 'Harmonic Current Emission Tests';
  }
  if (std.includes('M21.4.12') || std.includes('VOLTAGE FLUCTUATION')) {
    return 'Voltage Fluctuation & Flicker Tests';
  }
  if (std.includes('M21.4.14') || std.includes('ELECTROSTATIC DISCHARGE')) {
    return 'Electrostatic Discharge (ESD) Tests';
  }
  if (std.includes('M21.4.15') || std.includes('RF RADIATED')) {
    return 'RF Radiated Electromagnetic Field Immunity';
  }
  if (std.includes('M21.4.16') || std.includes('ELECTRICAL FAST TRANSIENT')) {
    return 'Electrical Fast Transient/Burst Tests';
  }
  if (std.includes('M21.4.17') || std.includes('SURGE IMMUNITY')) {
    return 'Surge Immunity Tests';
  }
  if (std.includes('M21.4.18') || std.includes('RF CONDUCTED')) {
    return 'RF Conducted Immunity Tests';
  }
  if (std.includes('M21.4.19') || std.includes('POWER FREQUENCY MAGNETIC')) {
    return 'Power Frequency Magnetic Field Immunity';
  }
  if (std.includes('M21.4.20') || std.includes('A.C. POWER SUPPLY')) {
    return 'AC Power Supply Fluctuation Immunity';
  }
  if (std.includes('M21.27') || std.includes('RADIO TRANSMITTER')) {
    return 'Radio Transmitter Tests';
  }
  if (std.includes('M21.20') || std.includes('RADIO RECEIVER')) {
    return 'Radio Receiver Tests';
  }
  if (std.includes('JIS') || std.includes('J-')) {
    return 'Japanese Standards';
  }
  if (std.includes('VCCI')) {
    return 'VCCI (Japan EMC)';
  }
  if (std.includes('EN 55') || std.includes('CISPR')) {
    return 'Emissions Standards';
  }
  if (std.includes('EN 61000') || std.includes('IEC 61000')) {
    return 'EMC Immunity Standards';
  }
  if (std.includes('EN 60601') || std.includes('IEC 60601')) {
    return 'Medical Device Standards';
  }
  
  return 'Other Standards';
}