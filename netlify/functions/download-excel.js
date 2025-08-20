// Download Excel file directly from EC official source - Netlify Function
const fs = require('fs');
const path = require('path');
const { getSiteUrl, getDirectivesUrls, log, logError } = require('./utils/config');

// Load directive configuration from external JSON file with multi-path fallback
async function loadDirectivesData() {
  // First try file system paths
  const possiblePaths = [
    path.join(__dirname, '../../static/api/directives.json'),
    path.join(process.cwd(), 'static/api/directives.json'),
    path.join(process.cwd(), 'static', 'api', 'directives.json'),
    '/var/task/static/api/directives.json',
    './static/api/directives.json'
  ];

  for (const testPath of possiblePaths) {
    try {
      if (fs.existsSync(testPath)) {
        log(`Found directives.json at: ${testPath}`);
        const content = fs.readFileSync(testPath, 'utf-8');
        const parsed = JSON.parse(content);
        return parsed.data;
      }
    } catch (e) {
      log(`Error checking path ${testPath}: ${e.message}`);
    }
  }
  
  // HTTP fetch fallback
  log('File system access failed, trying HTTP fetch...');
  try {
    const fetch = require('node-fetch');
    const possibleUrls = getDirectivesUrls();
    
    for (const url of possibleUrls) {
      log(`Trying HTTP fetch from: ${url}`);
      try {
        const response = await fetch(url);
        if (response.ok) {
          const text = await response.text();
          const parsed = JSON.parse(text);
          log(`Successfully fetched directives.json via HTTP from ${url}`);
          return parsed.data;
        }
      } catch (fetchError) {
        logError(`HTTP fetch error for ${url}: ${fetchError.message}`);
      }
    }
  } catch (e) {
    logError(`HTTP fetch setup error: ${e.message}`);
  }
  
  logError('directives.json not found in any expected location');
  return [];
}

async function getDirectiveConfig(code) {
  const directivesData = await loadDirectivesData();
  return directivesData.find(d => d.code === code);
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const directive = event.queryStringParameters?.directive;
    log(`Direct Excel download requested for directive: ${directive}`);
    
    const config = await getDirectiveConfig(directive);
    log(`Found config for ${directive}:`, config);

    if (!directive || !config || !config.excel_url) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Invalid directive code. Use EMC, RED, or LVD.'
        })
      };
    }

    log(`Proxying Excel download from: ${config.excel_url}`);

    // Download the Excel file directly from EC official source
    const response = await fetch(config.excel_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    log(`Excel download successful: ${response.status}, Size: ${arrayBuffer.byteLength} bytes`);

    // Generate filename with current date
    const today = new Date().toISOString().split('T')[0];
    const filename = `EU_Harmonised_Standards_${directive}_${today}.xlsx`;

    // Return the Excel file directly
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      },
      body: Buffer.from(arrayBuffer).toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    logError('Excel download error:', error.message);
    
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: `Excel download failed: ${error.message}`
      })
    };
  }
};