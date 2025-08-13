// Certificate PDF file server
const fs = require('fs');
const path = require('path');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
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
    const { cert_type, cert_number } = event.queryStringParameters || {};

    if (!cert_type || !cert_number) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing cert_type or cert_number parameter'
        })
      };
    }

    console.log(`Certificate PDF request: cert_type=${cert_type}, cert_number=${cert_number}`);

    // Construct PDF filename
    const filename = `${cert_type}-${cert_number}.pdf`;
    
    // Try multiple possible paths for PDF files
    const possiblePaths = [
      path.join(__dirname, '../../static/certificates', filename),
      path.join(process.cwd(), 'static/certificates', filename),
      path.join(process.cwd(), 'static', 'certificates', filename),
      `/var/task/static/certificates/${filename}`,
      `./static/certificates/${filename}`
    ];

    let pdfFilePath = null;
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        pdfFilePath = testPath;
        console.log(`Found PDF file at: ${pdfFilePath}`);
        break;
      }
    }

    if (!pdfFilePath) {
      // Try HTTP fallback for Netlify production
      const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://eu-harmonized-standards.netlify.app';
      const pdfUrl = `${baseUrl}/certificates/${filename}`;
      
      console.log(`PDF file not found locally, redirecting to: ${pdfUrl}`);
      
      return {
        statusCode: 302,
        headers: {
          ...headers,
          'Location': pdfUrl
        },
        body: ''
      };
    }

    // Read and serve PDF file
    const pdfBuffer = fs.readFileSync(pdfFilePath);
    const base64Pdf = pdfBuffer.toString('base64');

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`
      },
      body: base64Pdf,
      isBase64Encoded: true
    };

  } catch (error) {
    console.error('Certificate PDF error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: `Certificate PDF failed: ${error.message}`
      })
    };
  }
};