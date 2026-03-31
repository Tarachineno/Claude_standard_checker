// Shared utilities for MD file processing
const fs = require('fs');
const path = require('path');
const { getSiteUrl, log, logError } = require('./config');

/**
 * Find data file with standard Netlify paths
 * @param {string} filename - The filename to find (e.g., 'a2la-scopes.md', 'directives.json')
 * @param {string} dataDir - The data directory ('data' or 'api')
 * @returns {string|null} - Path to file if found, null otherwise
 */
function findDataFile(filename, dataDir = 'data') {
  const possiblePaths = [
    path.join(__dirname, '../../../static', dataDir, filename),
    path.join(process.cwd(), 'static', dataDir, filename),
    path.join(process.cwd(), 'static/' + dataDir, filename),
    `/var/task/static/${dataDir}/${filename}`,
    `./static/${dataDir}/${filename}`
  ];

  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      log(`Found data file at: ${testPath}`);
      return testPath;
    }
  }

  log(`Data file not found: ${filename} in ${dataDir}/`);
  return null;
}

/**
 * Fetch remote file via HTTP as fallback
 * @param {string} filename - The filename to fetch
 * @param {string} dataDir - The data directory ('data' or 'api')  
 * @returns {Promise<string>} - File content as string
 */
async function fetchRemote(filename, dataDir = 'data') {
  const baseUrl = getSiteUrl();
  const fileUrl = `${baseUrl}/${dataDir}/${filename}`;
  
  log(`Fetching remote file from: ${fileUrl}`);
  
  const https = require('https');
  const http = require('http');
  
  return new Promise((resolve, reject) => {
    const client = fileUrl.startsWith('https:') ? https : http;
    const request = client.get(fileUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${fileUrl}`));
        return;
      }
      
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        log(`Successfully fetched remote file (${data.length} chars)`);
        resolve(data);
      });
    });
    
    request.on('error', reject);
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('HTTP request timeout'));
    });
  });
}

/**
 * Load file content with file system first, HTTP fallback
 * @param {string} filename - The filename to load
 * @param {string} dataDir - The data directory ('data' or 'api')
 * @returns {Promise<string>} - File content as string
 */
async function loadFileContent(filename, dataDir = 'data') {
  try {
    // Try file system first (local development)
    const filePath = findDataFile(filename, dataDir);
    
    if (filePath) {
      const content = fs.readFileSync(filePath, 'utf-8');
      log(`Loaded from file system: ${filePath} (${content.length} chars)`);
      return content;
    }
    
    // HTTP fallback for Netlify production
    log(`File system failed, trying HTTP fallback for ${filename}`);
    const content = await fetchRemote(filename, dataDir);
    return content;
    
  } catch (error) {
    logError(`Error loading file ${filename}:`, error);
    throw error;
  }
}

/**
 * Parse markdown content into structured scope data
 * @param {string} mdContent - Raw markdown content
 * @param {string} certType - Certificate type ('a2la' or 'jab')
 * @returns {Object} - Parsed scope data with metadata and sections
 */
function parseMDToScopeData(mdContent, certType) {
  const lines = mdContent.split('\n');
  const scopeData = {
    scopes: []
  };

  let currentCategory = null;
  let currentAnchor = null;
  let currentFacility = null;
  let inMetadata = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;

    // Stop metadata parsing when we hit main content
    if (line.startsWith('## ') || line.startsWith('### ')) {
      inMetadata = false;
    }

    // Parse facility headers for JAB (【施設X】pattern)
    if (certType === 'jab' && line.includes('【施設') && line.includes('】')) {
      const facilityMatch = line.match(/【施設(\d+)】(.+)（(.+)）/);
      if (facilityMatch) {
        currentFacility = `施設${facilityMatch[1]}: ${facilityMatch[2].trim()}`;
        continue;
      }
    }

    // Parse section headers with anchors
    if (line.startsWith('### ') && line.includes('{#')) {
      const match = line.match(/### (.+) \{#([^}]+)\}/);
      if (match) {
        currentCategory = match[1];
        currentAnchor = `#${match[2]}`;
        continue;
      }
    }

    // Parse standard entries (lines starting with - **)
    if (line.startsWith('- **') && line.includes('**')) {
      const match = line.match(/- \*\*([^*]+)\*\*\s*-?\s*(.*)/);
      if (match) {
        const standard = match[1].trim();
        const description = match[2].trim();
        
        scopeData.scopes.push({
          standard: standard,
          description: description,
          anchor: currentAnchor,
          facility: currentFacility
        });
      }
    }
  }

  return scopeData;
}

/**
 * Parse certificate MD content with metadata extraction
 * @param {string} mdContent - Raw markdown content
 * @param {string} certType - Certificate type ('a2la' or 'jab')
 * @returns {Object} - Parsed certificate data with metadata, categories, and standards
 */
function parseCertificateMD(mdContent, certType) {
  const lines = mdContent.split('\n');
  const certificateData = {
    certificate_info: {},
    test_standards: [],
    categories: {},
    certificate_type: `${certType.toUpperCase()}_MD_Dynamic`
  };

  let currentCategory = null;
  let currentFacility = null;
  let inMetadata = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;

    // Parse metadata at the top (before main content)
    if (inMetadata && line.startsWith('**') && line.includes(':**')) {
      const metaMatch = line.match(/\*\*([^*]+):\*\*\s*(.+)/);
      if (metaMatch) {
        const key = metaMatch[1];
        const value = metaMatch[2];
        
        // Map common metadata fields
        switch (key) {
          case 'Certificate Number':
            certificateData.certificate_info.certificate_number = value;
            break;
          case 'Organization':
            certificateData.certificate_info.organization = value;
            break;
          case 'Valid Until':
            certificateData.certificate_info.valid_until = value;
            break;
          case 'Accreditation Body':
            certificateData.certificate_info.accreditation_body = value;
            break;
          default:
            certificateData.certificate_info[key.toLowerCase().replace(/\s+/g, '_')] = value;
        }
        continue;
      }
    }

    // Stop metadata parsing when we hit main content
    if (line.startsWith('## ') || line.startsWith('### ')) {
      inMetadata = false;
    }

    // Parse facility headers for JAB
    if (certType === 'jab' && line.includes('【施設') && line.includes('】')) {
      const facilityMatch = line.match(/【施設(\d+)】(.+)（(.+)）/);
      if (facilityMatch) {
        currentFacility = {
          facility_number: facilityMatch[1],
          name: facilityMatch[2].trim(),
          location: facilityMatch[3],
          standards: []
        };
        
        if (!certificateData.facilities) {
          certificateData.facilities = [];
        }
        certificateData.facilities.push(currentFacility);
        
        continue;
      }
    }

    // Parse section headers with anchors
    if (line.startsWith('### ') && line.includes('{#')) {
      const match = line.match(/### (.+) \{#([^}]+)\}/);
      if (match) {
        currentCategory = match[1];
        if (!certificateData.categories[currentCategory]) {
          certificateData.categories[currentCategory] = [];
        }
        continue;
      }
    }

    // Parse standard entries
    if (line.startsWith('- **') && line.includes('**')) {
      const match = line.match(/- \*\*([^*]+)\*\*\s*-?\s*(.*)/);
      if (match) {
        const standard = match[1].trim();
        const description = match[2].trim();
        
        const standardEntry = {
          standard: standard,
          description: description,
          category: currentCategory
        };

        // Add to main standards list
        certificateData.test_standards.push(standardEntry);

        // Add to category
        if (currentCategory && certificateData.categories[currentCategory]) {
          certificateData.categories[currentCategory].push(standardEntry);
        }

        // Add to facility (for JAB)
        if (currentFacility) {
          currentFacility.standards.push(standardEntry);
        }
      }
    }
  }

  // For JAB, structure by facilities is already handled as they are pushed upon creation

  return certificateData;
}

module.exports = {
  findDataFile,
  fetchRemote,
  loadFileContent,
  parseMDToScopeData,
  parseCertificateMD
};