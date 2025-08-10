// Download Excel file directly from EC official source - Netlify Function
const axios = require('axios');
const fs = require('fs');
const path = require('path');

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
        console.log(`Found directives.json at: ${testPath}`);
        const content = fs.readFileSync(testPath, 'utf-8');
        const parsed = JSON.parse(content);
        return parsed.data;
      }
    } catch (e) {
      console.log(`Error checking path ${testPath}: ${e.message}`);
    }
  }
  
  // HTTP fetch fallback
  console.log('File system access failed, trying HTTP fetch...');
  try {
    const fetch = require('node-fetch');
    const siteUrl = process.env.URL || process.env.DEPLOY_URL || 'https://webstandardchacker.netlify.app';
    const possibleUrls = [
      `${siteUrl}/api/directives.json`,
      `${siteUrl}/static/api/directives.json`,
      'https://webstandardchacker.netlify.app/api/directives.json'
    ];
    
    for (const url of possibleUrls) {
      console.log(`Trying HTTP fetch from: ${url}`);
      try {
        const response = await fetch(url);
        if (response.ok) {
          const text = await response.text();
          const parsed = JSON.parse(text);
          console.log(`Successfully fetched directives.json via HTTP from ${url}`);
          return parsed.data;
        }
      } catch (fetchError) {
        console.error(`HTTP fetch error for ${url}: ${fetchError.message}`);
      }
    }
  } catch (e) {
    console.error(`HTTP fetch setup error: ${e.message}`);
  }
  
  console.error('directives.json not found in any expected location');
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
    console.log(`Direct Excel download requested for directive: ${directive}`);
    
    const config = await getDirectiveConfig(directive);
    console.log(`Found config for ${directive}:`, config);

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

    console.log(`Proxying Excel download from: ${config.excel_url}`);

    // Download the Excel file directly from EC official source
    const response = await axios.get(config.excel_url, {
      timeout: 60000, // 60 seconds timeout for large files
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    });

    console.log(`Excel download successful: ${response.status}, Size: ${response.data.byteLength} bytes`);

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
        'Content-Length': response.data.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      },
      body: Buffer.from(response.data).toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    console.error('Excel download error:', error.message);
    
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