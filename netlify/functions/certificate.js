// Minimal certificate processing without heavy dependencies
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

    // Check if it looks like a PDF
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

    // For now, return success without processing
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          certificate_info: {
            certificate_number: 'Minimal processing mode',
            organization: 'File received successfully',
            valid_until: 'Unknown',
            accreditation_body: 'Unknown',
            revision_date: 'Unknown'
          },
          test_standards: [],
          categories: {},
          total_standards: 0,
          extraction_date: new Date().toISOString(),
          pdf_source: requestData.fileName,
          certificate_type: 'Minimal_Processing',
          note: `Successfully received and validated PDF file: ${requestData.fileName} (${fileBuffer.length} bytes)`
        }
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