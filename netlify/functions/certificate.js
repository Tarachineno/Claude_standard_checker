// Certificate processing without pdf-parse (basic validation only)
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

    // Basic PDF validation only (no parsing)
    console.log('Validating PDF file...');
    
    // Check if it looks like a PDF by header
    const pdfHeader = fileBuffer.slice(0, 4).toString();
    console.log('File header:', pdfHeader);

    if (!pdfHeader.startsWith('%PDF')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'File does not appear to be a valid PDF'
        })
      };
    }

    // Determine certificate type based on filename
    const isA2LA = requestData.fileName.toLowerCase().includes('a2la');
    const isJAB = requestData.fileName.toLowerCase().includes('jab');
    
    console.log('Certificate type detection:', { isA2LA, isJAB });

    // Return basic information without parsing
    const certificateData = {
      certificate_info: {
        certificate_number: extractCertNumberFromFilename(requestData.fileName),
        organization: isA2LA ? 'A2LA Certificate Detected' : isJAB ? 'JAB Certificate Detected' : 'Certificate Type Unknown',
        valid_until: 'Parsing Disabled',
        accreditation_body: isA2LA ? 'A2LA' : isJAB ? 'JAB' : 'Unknown',
        revision_date: 'Unknown'
      },
      test_standards: [],
      categories: {},
      total_standards: 0,
      extraction_date: new Date().toISOString(),
      pdf_source: requestData.fileName,
      certificate_type: 'Basic_Validation_Only',
      note: `PDF file validated successfully: ${requestData.fileName} (${fileBuffer.length} bytes). Full text parsing is disabled to avoid server errors.`
    };

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

// Helper function to extract certificate number from filename
function extractCertNumberFromFilename(filename) {
  if (!filename) return 'Unknown';
  
  const certNumMatch = filename.match(/(\d{4}-\d{2})/);
  if (certNumMatch) {
    return certNumMatch[1];
  }
  
  return 'Unknown';
}