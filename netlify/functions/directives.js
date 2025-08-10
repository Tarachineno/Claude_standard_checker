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
    // Try multiple possible paths for Netlify deployment
    const possiblePaths = [
      path.join(__dirname, '../../static/api/directives.json'),
      path.join(process.cwd(), 'static/api/directives.json'),
      path.join(process.cwd(), 'static', 'api', 'directives.json'),
      '/var/task/static/api/directives.json',
      './static/api/directives.json'
    ];

    let directivesData = null;
    let foundPath = null;

    for (const testPath of possiblePaths) {
      try {
        directivesData = await fs.readFile(testPath, 'utf8');
        foundPath = testPath;
        console.log(`Found directives.json at: ${foundPath}`);
        break;
      } catch (e) {
        console.log(`Error checking path ${testPath}: ${e.message}`);
      }
    }

    // If file system access fails, try HTTP fetch
    if (!directivesData) {
      console.log('File system access failed, trying HTTP fetch...');
      try {
        const siteUrl = process.env.URL || process.env.DEPLOY_URL || 'https://webstandardchacker.netlify.app';
        const possibleUrls = [
          `${siteUrl}/api/directives.json`,
          `${siteUrl}/static/api/directives.json`,
          'https://webstandardchacker.netlify.app/api/directives.json'
        ];
        
        // Import fetch for Node.js environment
        const fetch = require('node-fetch');
        
        for (const url of possibleUrls) {
          console.log(`Trying HTTP fetch from: ${url}`);
          try {
            const response = await fetch(url);
            console.log(`Response status: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
              directivesData = await response.text();
              console.log(`Successfully fetched directives.json via HTTP from ${url}`);
              break;
            } else {
              console.error(`HTTP fetch failed for ${url}: ${response.status} ${response.statusText}`);
            }
          } catch (fetchError) {
            console.error(`HTTP fetch error for ${url}: ${fetchError.message}`);
          }
        }
      } catch (e) {
        console.error(`HTTP fetch setup error: ${e.message}`);
      }
    }
    
    if (!directivesData) {
      throw new Error('directives.json not found in any expected location');
    }

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