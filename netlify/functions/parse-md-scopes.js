// Parse markdown scope files and convert to structured data
const { loadFileContent, parseMDToScopeData } = require('./utils/md');
const { log, logError } = require('./utils/config');

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

    const filename = `${cert_type}-scopes.md`;
    const mdContent = await loadFileContent(filename, 'data');
    log(`Loaded MD file: ${filename} (${mdContent.length} characters)`);

    // Parse MD content into structured data
    const scopeData = parseMDToScopeData(mdContent, cert_type);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: scopeData
      })
    };

  } catch (error) {
    logError('MD parsing error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: `MD parsing failed: ${error.message}`
      })
    };
  }
};