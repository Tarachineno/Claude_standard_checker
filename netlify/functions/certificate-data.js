// Certificate data loading function with dynamic MD file support
const { loadFileContent, parseCertificateMD } = require('./utils/md');

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
    const { cert_type } = event.queryStringParameters || {};
    
    if (!cert_type || !['a2la', 'jab'].includes(cert_type)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid cert_type. Must be "a2la" or "jab"'
        })
      };
    }

    console.log(`Loading certificate data for: ${cert_type}`);

    // Load certificate data dynamically from MD files
    const certificateData = await loadCertificateFromMD(cert_type);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: certificateData
      })
    };

  } catch (error) {
    console.error('Certificate data loading error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: `Certificate data loading failed: ${error.message}`
      })
    };
  }
};

// Load certificate data from MD files
async function loadCertificateFromMD(certType) {
  try {
    const filename = `${certType}-scopes.md`;
    const mdContent = await loadFileContent(filename, 'data');
    
    const parsedData = parseCertificateMD(mdContent, certType);
    
    console.log(`Successfully loaded ${parsedData.test_standards.length} standards from ${filename}`);
    return parsedData;
    
  } catch (error) {
    console.error(`Error loading MD file for ${certType}:`, error);
    throw error; // No fallback - force MD file usage
  }
}


