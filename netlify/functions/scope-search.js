// Scope search function for ISO17025 certificates
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

  if (event.httpMethod !== 'POST') {
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
    const requestData = JSON.parse(event.body);
    const { search_query } = requestData;

    if (!search_query || typeof search_query !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing or invalid search_query'
        })
      };
    }

    console.log('Searching for:', search_query);

    // Load certificate scope data dynamically from MD files
    const a2laScopes = await loadScopesFromMD('a2la');
    const jabScopes = await loadScopesFromMD('jab');

    // Search in both certificate scopes
    const a2laMatches = searchInScopes(search_query, a2laScopes);
    const jabMatches = searchInScopes(search_query, jabScopes);

    const totalMatches = a2laMatches.length + jabMatches.length;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          search_query: search_query,
          total_matches: totalMatches,
          a2la_matches: a2laMatches,
          jab_matches: jabMatches
        }
      })
    };

  } catch (error) {
    console.error('Scope search error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: `Scope search failed: ${error.message}`
      })
    };
  }
};

// Search for matching standards in certificate scopes
function searchInScopes(searchQuery, scopes) {
  const matches = [];
  const cleanQuery = searchQuery.toLowerCase().trim();

  for (const scope of scopes) {
    const matchResult = findMatch(cleanQuery, scope);
    if (matchResult) {
      matches.push({
        standard: scope.standard,
        description: scope.description || '',
        facility: scope.facility || null,
        anchor: scope.anchor,
        match_type: matchResult.type,
        note: matchResult.note || null
      });
    }
  }

  return matches;
}

// Find match between search query and scope standard
function findMatch(searchQuery, scope) {
  const scopeStandard = scope.standard.toLowerCase();
  
  // Direct substring match (most flexible)
  if (scopeStandard.includes(searchQuery)) {
    return { type: 'partial' };
  }
  
  // Extract core numbers for more precise matching
  const queryCore = extractStandardCore(searchQuery);
  const scopeCore = extractStandardCore(scope.standard);
  
  if (!queryCore || !scopeCore) {
    return null;
  }
  
  if (queryCore === scopeCore) {
    // Core numbers match, check for exact, prefix, or version differences
    const queryFull = searchQuery.toLowerCase();
    const scopeFull = scopeStandard;
    
    if (queryFull === scopeFull) {
      return { type: 'exact' };
    }
    
    const queryVersion = extractVersion(searchQuery);
    const scopeVersion = extractVersion(scope.standard);
    
    if (queryVersion && scopeVersion && queryVersion !== scopeVersion) {
      return { 
        type: 'version_mismatch',
        note: `年版違い(${queryVersion}↔${scopeVersion})`
      };
    }
    
    // Check for prefix differences
    const queryPrefix = searchQuery.replace(queryCore, '').replace(queryVersion || '', '').trim();
    const scopePrefix = scope.standard.replace(scopeCore, '').replace(scopeVersion || '', '').trim();
    
    if (queryPrefix.toLowerCase() !== scopePrefix.toLowerCase()) {
      return { 
        type: 'prefix_mismatch',
        note: `表記違い(${queryPrefix || '?'}/${scopePrefix || '?'})`
      };
    }
    
    return { type: 'partial' };
  }
  
  return null;
}

// Extract core number from standard (e.g., "EN 55032:2015" -> "55032")
function extractStandardCore(standard) {
  if (!standard) return '';
  
  // Remove common prefixes and extract core number
  const cleaned = standard
    .replace(/^(EN|ETSI|IEC|ISO|CISPR|JIS|KS)\s*/i, '')
    .replace(/^(EN|ETSI|IEC|ISO|CISPR|JIS|KS)(\s*)/i, '')
    .replace(/^(C|T)\s+/i, '') // For JIS C, KS C patterns
    .trim();
  
  // Extract the main number part (e.g., "55032", "61000-4-2", "301 489-1")
  const match = cleaned.match(/^(\d+(?:[-\s]\d+)*)/);
  return match ? match[1].replace(/\s+/g, '-') : '';
}

// Extract version/year from standard
function extractVersion(standard) {
  if (!standard) return '';
  
  // Match patterns like ":2015", "(2004)", "V1.2.3"
  const versionMatch = standard.match(/:(\d{4})|(\(\d{4}\))|(V\d+\.\d+\.\d+)/);
  return versionMatch ? (versionMatch[1] || versionMatch[2] || versionMatch[3]) : '';
}

// Load scopes dynamically from MD files
async function loadScopesFromMD(certType) {
  try {
    // Try file system first (for local development)
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
    }

    let mdContent = '';
    
    if (mdFilePath) {
      // File system access (local development)
      mdContent = fs.readFileSync(mdFilePath, 'utf-8');
      console.log(`Loaded from file system: ${mdFilePath}`);
    } else {
      // HTTP fallback for Netlify production
      console.log(`File system failed, trying HTTP fallback for ${certType}-scopes.md`);
      
      const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://eu-harmonized-standards.netlify.app';
      const mdUrl = `${baseUrl}/data/${certType}-scopes.md`;
      
      console.log(`Fetching MD file from: ${mdUrl}`);
      
      const https = require('https');
      const http = require('http');
      
      mdContent = await new Promise((resolve, reject) => {
        const client = mdUrl.startsWith('https:') ? https : http;
        const request = client.get(mdUrl, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode} for ${mdUrl}`));
            return;
          }
          
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => resolve(data));
        });
        
        request.on('error', reject);
        request.setTimeout(10000, () => {
          request.destroy();
          reject(new Error('HTTP request timeout'));
        });
      });
      
      console.log(`Successfully loaded MD content via HTTP (${mdContent.length} chars)`);
    }

    if (!mdContent) {
      throw new Error(`No MD content loaded for ${certType}-scopes.md`);
    }

    const scopeData = parseMDToScopeData(mdContent, certType);
    
    console.log(`Loaded ${scopeData.scopes.length} scopes from ${certType}-scopes.md`);
    return scopeData.scopes;

  } catch (error) {
    console.error(`Error loading MD file for ${certType}:`, error);
    return [];
  }
}

// Parse markdown content into structured scope data
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
