// Download Excel file - Netlify Function
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load directive configuration from external JSON file with multi-path fallback
function loadDirectivesData() {
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
        return JSON.parse(fs.readFileSync(testPath, 'utf-8')).data;
      }
    } catch (e) {
      console.log(`Error checking path ${testPath}: ${e.message}`);
    }
  }
  
  console.error('directives.json not found in any expected location');
  return [];
}

let directivesData = loadDirectivesData();

function getDirectiveConfig(code) {
  // If directives data is empty, try to reload it
  if (!directivesData || directivesData.length === 0) {
    console.log('Directives data empty, attempting reload...');
    directivesData = loadDirectivesData();
  }
  
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
    const config = getDirectiveConfig(directive);

    if (!directive || !config) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Invalid directive code. Use EMC, RED, or LVD.'
        })
      };
    }

    console.log(`Downloading Excel file for ${directive} directive`);

    // Download the Excel file
    const response = await axios.get(config.excel_url, {
      timeout: 30000,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    console.log(`Excel file downloaded for ${directive}, size: ${response.data.length} bytes`);

    // Save a copy to static/data for caching
    const dataDir = path.join(__dirname, '../../static/data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, `${directive}.xlsx`), response.data);

    // Return the Excel file as downloadable content
    const filename = `EU_Harmonised_Standards_${directive}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': response.data.length.toString()
      },
      body: Buffer.from(response.data).toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    console.error('Error downloading Excel file:', error);
    
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: `Failed to download Excel file: ${error.message}`
      })
    };
  }
};