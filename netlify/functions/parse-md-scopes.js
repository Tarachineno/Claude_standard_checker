// Parse markdown scope files and convert to structured data
const fs = require('fs');
const path = require('path');

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

    // Try multiple possible paths for Netlify deployment
    const possiblePaths = [
      path.join(__dirname, '../../static/data', `${cert_type}-scopes.md`),
      path.join(process.cwd(), 'static/data', `${cert_type}-scopes.md`),
      path.join(process.cwd(), 'static', 'data', `${cert_type}-scopes.md`),
      `/var/task/static/data/${cert_type}-scopes.md`,
      `./static/data/${cert_type}-scopes.md`
    ];

    let mdFilePath = null;
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        mdFilePath = testPath;
        console.log(`Found MD file at: ${mdFilePath}`);
        break;
      }
    }
    
    if (!mdFilePath) {
      console.error(`MD file not found in any of the following paths:`, possiblePaths);
      throw new Error(`MD file not found: ${cert_type}-scopes.md`);
    }

    const mdContent = fs.readFileSync(mdFilePath, 'utf-8');
    console.log(`Loaded MD file: ${cert_type}-scopes.md (${mdContent.length} characters)`);

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
    console.error('MD parsing error:', error);
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

// Parse markdown content into structured scope data
function parseMDToScopeData(mdContent, certType) {
  const lines = mdContent.split('\n');
  const scopeData = {
    certificate_info: {},
    scopes: [],
    categories: {},
    facilities: certType === 'jab' ? [] : null
  };

  let currentSection = null;
  let currentCategory = null;
  let currentAnchor = null;
  let currentFacility = null;
  let inMetadata = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;

    // Parse certificate metadata (top of file)
    if (inMetadata && line.startsWith('**') && line.includes(':')) {
      const match = line.match(/\*\*([^*]+):\*\*\s*(.+)/);
      if (match) {
        const key = match[1].toLowerCase().replace(/\s+/g, '_');
        const value = match[2];
        scopeData.certificate_info[key] = value;
        continue;
      }
    }

    // Stop metadata parsing when we hit main content
    if (line.startsWith('## ') || line.startsWith('### ')) {
      inMetadata = false;
    }

    // Parse facility headers for JAB (【施設X】pattern)
    if (certType === 'jab' && line.includes('【施設') && line.includes('】')) {
      const facilityMatch = line.match(/【施設(\d+)】(.+)（(.+)）/);
      if (facilityMatch) {
        currentFacility = {
          facility_number: facilityMatch[1],
          name: facilityMatch[2].trim(),
          location: facilityMatch[3].trim(),
          scopes: []
        };
        scopeData.facilities.push(currentFacility);
        continue;
      }
    }

    // Parse section headers with anchors
    if (line.startsWith('### ') && line.includes('{#')) {
      const match = line.match(/### (.+) \{#([^}]+)\}/);
      if (match) {
        currentCategory = match[1];
        currentAnchor = `#${match[2]}`;
        
        if (!scopeData.categories[currentCategory]) {
          scopeData.categories[currentCategory] = [];
        }
        continue;
      }
    }

    // Parse standard entries (lines starting with - **)
    if (line.startsWith('- **') && line.includes('**')) {
      const match = line.match(/- \*\*([^*]+)\*\*\s*-?\s*(.*)/);
      if (match) {
        const standard = match[1].trim();
        const description = match[2].trim();
        
        const scopeEntry = {
          standard: standard,
          description: description,
          category: currentCategory,
          anchor: currentAnchor,
          facility: currentFacility ? `施設${currentFacility.facility_number}: ${currentFacility.name}` : null
        };

        scopeData.scopes.push(scopeEntry);
        
        // Add to category
        if (currentCategory && !scopeData.categories[currentCategory].includes(standard)) {
          scopeData.categories[currentCategory].push(standard);
        }

        // Add to facility (JAB only)
        if (currentFacility) {
          currentFacility.scopes.push(scopeEntry);
        }
      }
    }
  }

  console.log(`Parsed ${scopeData.scopes.length} standards from ${certType} MD file`);
  return scopeData;
}