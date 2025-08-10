// Get available directives - Netlify Function
const fs = require('fs').promises;
const path = require('path');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Read directives from static file
    const directivesPath = path.join(process.cwd(), 'static', 'api', 'directives.json');
    const directivesData = await fs.readFile(directivesPath, 'utf8');
    const directivesJson = JSON.parse(directivesData);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(directivesJson)
    };
  } catch (error) {
    console.error('Error reading directives:', error);
    
    // No fallback - directives.json must be available
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Directives configuration file not found. Please ensure directives.json is available.'
      })
    };
  }
};