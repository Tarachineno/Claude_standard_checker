// Certificate data loading function with dynamic MD file support
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
    // Try multiple possible paths for Netlify deployment
    const possiblePaths = [
      path.join(__dirname, '../../static/data', `${certType}-scopes.md`),
      path.join(process.cwd(), 'static/data', `${certType}-scopes.md`),
      path.join(process.cwd(), 'static', 'data', `${certType}-scopes.md`),
      `/var/task/static/data/${certType}-scopes.md`,
      `./static/data/${certType}-scopes.md`
    ];

    let mdFilePath = null;
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        mdFilePath = testPath;
        console.log(`Found MD file at: ${mdFilePath}`);
        break;
      }
      console.log(`Checked path (not found): ${testPath}`);
    }
    
    if (!mdFilePath) {
      console.error(`MD file not found in any of the following paths:`, possiblePaths);
      throw new Error(`MD file not found: ${certType}-scopes.md`);
    }

    const mdContent = fs.readFileSync(mdFilePath, 'utf-8');
    const parsedData = parseCertificateMD(mdContent, certType);
    
    console.log(`Successfully loaded ${parsedData.test_standards.length} standards from ${certType}-scopes.md`);
    return parsedData;
    
  } catch (error) {
    console.error(`Error loading MD file for ${certType}:`, error);
    throw error; // No fallback - force MD file usage
  }
}

// Parse certificate MD file into frontend-compatible format
function parseCertificateMD(mdContent, certType) {
  const lines = mdContent.split('\n');
  
  const certificateData = {
    certificate_info: {},
    test_standards: [],
    categories: {},
    certificate_type: certType.toUpperCase() + '_MD_Dynamic'
  };
  
  // For JAB certificates, also include facilities
  if (certType === 'jab') {
    certificateData.facilities = [];
  }

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
        certificateData.certificate_info[key] = value;
        continue;
      }
    }

    // Stop metadata parsing when we hit main content
    if (line.startsWith('## ') || line.startsWith('### ')) {
      inMetadata = false;
    }

    // Parse facility headers for JAB (special format)
    if (certType === 'jab') {
      // Handle facility section headers: "## Facility X: Name {#facility-x}"
      if (line.startsWith('## Facility ') && line.includes('{#')) {
        const facilityMatch = line.match(/## Facility (\d+): (.+) \{#([^}]+)\}/);
        if (facilityMatch) {
          currentFacility = {
            facility_number: facilityMatch[1],
            name: facilityMatch[2],
            location: null, // Will be set from next line
            standards: []
          };
          certificateData.facilities.push(currentFacility);
          continue;
        }
      }

      // Handle facility location: "**Location:** 都道府県市区町村"
      if (currentFacility && line.startsWith('**Location:**')) {
        const locationMatch = line.match(/\*\*Location:\*\*\s*(.+)/);
        if (locationMatch) {
          currentFacility.location = locationMatch[1];
          continue;
        }
      }
    }

    // Parse section headers with anchors: "### Category {#anchor}"
    if (line.startsWith('### ') && line.includes('{#')) {
      const match = line.match(/### (.+) \{#([^}]+)\}/);
      if (match) {
        currentCategory = match[1];
        currentAnchor = `#${match[2]}`;
        
        if (!certificateData.categories[currentCategory]) {
          certificateData.categories[currentCategory] = [];
        }
        continue;
      }
    }

    // Parse standard entries: "- **STANDARD** - Description"
    if (line.startsWith('- **') && line.includes('**')) {
      const match = line.match(/- \*\*([^*]+)\*\*\s*-?\s*(.*)/);
      if (match) {
        const standardNumber = match[1].trim();
        const description = match[2].trim();
        
        const standardEntry = {
          standard_number: standardNumber,
          category: currentCategory || 'Uncategorized',
          description: description,
          anchor: currentAnchor
        };

        // Add facility information for JAB
        if (certType === 'jab' && currentFacility) {
          standardEntry.facility = `施設${currentFacility.facility_number}: ${currentFacility.name}`;
          currentFacility.standards.push(standardEntry);
        }

        certificateData.test_standards.push(standardEntry);
        
        // Add to category
        if (currentCategory && !certificateData.categories[currentCategory].includes(standardNumber)) {
          certificateData.categories[currentCategory].push(standardNumber);
        }
      }
    }
  }

  // Calculate total standards count
  certificateData.total_standards = certificateData.test_standards.length;

  return certificateData;
}