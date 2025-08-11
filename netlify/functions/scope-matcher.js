// Scope matching function for ISO17025 certificates  
// 
// ⚠️ PRODUCTION WARNING: This file contains debug fallback data
// TODO: Remove fallback test data before production deployment (lines ~340-357)
// 
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
    console.log('Scope matcher called with:', event.body);
    const requestData = JSON.parse(event.body);
    const { oj_standards } = requestData;

    if (!oj_standards || !Array.isArray(oj_standards)) {
      console.error('Invalid request data:', { oj_standards });
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing or invalid oj_standards array'
        })
      };
    }

    console.log(`Processing ${oj_standards.length} OJ standards for scope matching`);

    // Load certificate scope data dynamically from MD files
    console.log('Loading scope data from MD files...');
    const a2laScopes = await loadScopesFromMD('a2la');
    const jabScopes = await loadScopesFromMD('jab');
    
    console.log(`Loaded ${a2laScopes.length} A2LA scopes, ${jabScopes.length} JAB scopes`);

    // Match each OJ standard against certificate scopes
    const matchResults = oj_standards.map(standard => {
      const a2laMatch = findScopeMatch(standard, a2laScopes);
      const jabMatch = findScopeMatch(standard, jabScopes);

      return {
        standard: standard,
        scope_matches: {
          a2la: a2laMatch,
          jab: jabMatch
        }
      };
    });

    const a2laMatchCount = matchResults.filter(r => r.scope_matches.a2la.status !== 'no_match').length;
    const jabMatchCount = matchResults.filter(r => r.scope_matches.jab.status !== 'no_match').length;
    
    console.log(`Match results summary: ${a2laMatchCount} A2LA matches, ${jabMatchCount} JAB matches out of ${oj_standards.length} standards`);
    
    // Log first few standards for debugging
    console.log('First 3 OJ standards:', oj_standards.slice(0, 3));
    console.log('First 3 A2LA scopes:', a2laScopes.slice(0, 3));
    console.log('First 3 JAB scopes:', jabScopes.slice(0, 3));
    
    // Log sample match results
    if (matchResults.length > 0) {
      console.log('Sample match result:', JSON.stringify(matchResults[0], null, 2));
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          matches: matchResults,
          total_standards: oj_standards.length,
          a2la_matches: a2laMatchCount,
          jab_matches: jabMatchCount,
          debug: {
            a2la_scopes_count: a2laScopes.length,
            jab_scopes_count: jabScopes.length,
            first_oj_standards: oj_standards.slice(0, 3),
            first_a2la_scopes: a2laScopes.slice(0, 3).map(s => s.standard),
            first_jab_scopes: jabScopes.slice(0, 3).map(s => s.standard)
          }
        }
      })
    };

  } catch (error) {
    console.error('Scope matching error:', error);
    console.error('Error stack:', error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: `Scope matching failed: ${error.message}`,
        debug: {
          stack: error.stack,
          name: error.name
        }
      })
    };
  }
};

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

// Find matching scope for a given standard
function findScopeMatch(ojStandard, certificateScopes) {
  const ojCore = extractStandardCore(ojStandard);
  const ojVersion = extractVersion(ojStandard);
  
  if (!ojCore) {
    return {
      status: 'no_match',
      matched_standard: null,
      note: null,
      anchor: null
    };
  }

  // Extract specific part number from OJ standard (e.g., "301 489-52" from "EN 301 489-52 V1.2.1")
  const ojPartNumber = extractPartNumber(ojStandard);

  // Try to find matches in certificate scopes
  for (const scope of certificateScopes) {
    const scopeCore = extractStandardCore(scope.standard);
    const scopeVersion = extractVersion(scope.standard);

    // Check for exact match first
    if (ojCore === scopeCore) {
      if (ojStandard === scope.standard) {
        return {
          status: 'exact_match',
          matched_standard: scope.standard,
          note: null,
          anchor: scope.anchor,
          facility: scope.facility || null
        };
      }
      
      if (ojVersion && scopeVersion && ojVersion !== scopeVersion) {
        return {
          status: 'version_mismatch',
          matched_standard: scope.standard,
          note: `年版違い(${ojVersion}↔${scopeVersion})`,
          anchor: scope.anchor,
          facility: scope.facility || null
        };
      }
      
      // Prefix difference (same core, different prefix)
      const ojPrefix = ojStandard.replace(ojCore, '').replace(ojVersion, '').trim();
      const scopePrefix = scope.standard.replace(scopeCore, '').replace(scopeVersion, '').trim();
      
      if (ojPrefix !== scopePrefix) {
        return {
          status: 'prefix_mismatch',
          matched_standard: scope.standard,
          note: `表記違い(${ojPrefix || '?'}/${scopePrefix || '?'})`,
          anchor: scope.anchor,
          facility: scope.facility || null
        };
      }
    }

    // Check for comprehensive scope match (e.g., "EN 301 489-1/-3/-7/-52" includes "EN 301 489-52")
    if (ojPartNumber && isComprehensiveScopeMatch(ojPartNumber, scope.standard)) {
      return {
        status: 'comprehensive_match',
        matched_standard: scope.standard,
        note: `包括スコープ適用(${ojPartNumber}含む)`,
        anchor: scope.anchor,
        facility: scope.facility || null
      };
    }
  }

  return {
    status: 'no_match',
    matched_standard: null,
    note: null,
    anchor: null
  };
}

// Extract part number from standard (e.g., "EN 301 489-52 V1.2.1" -> "489-52")
function extractPartNumber(standard) {
  if (!standard) return '';
  
  // Remove prefixes and version info
  const cleaned = standard
    .replace(/^(EN|ETSI|IEC|ISO|CISPR|JIS|KS)\s*/i, '')
    .replace(/:?\d{4}.*$/, '')         // Remove :2015, (2015), etc.
    .replace(/\sV\d+\.\d+.*$/, '')     // Remove V1.2.1, etc.
    .trim();
  
  // Extract the part number (e.g., "301 489-52" -> "489-52", "55032" -> "55032")  
  const match = cleaned.match(/(?:\d+\s+)?(\d+(?:-\d+)*)/);
  return match ? match[1] : '';
}

// Check if comprehensive scope (like "EN 301 489-1/-3/-7/-52") includes specific part
function isComprehensiveScopeMatch(ojPartNumber, scopeStandard) {
  if (!ojPartNumber || !scopeStandard) return false;
  
  // Look for patterns like "EN 301 489-1/-3/-7/-9/-15/-17/-19/-24/-51/-52"
  const comprehensivePattern = /(\d+(?:\s+\d+)*)-(\d+)(?:\/-\d+)+/;
  const match = scopeStandard.match(comprehensivePattern);
  
  if (!match) return false;
  
  const baseNumber = match[1];  // e.g., "301 489"
  const scopeParts = scopeStandard.match(/-(\d+)/g);  // ["-1", "-3", "-7", "-52", etc.]
  
  if (!scopeParts) return false;
  
  // Extract part numbers (remove the "-" prefix)
  const includedParts = scopeParts.map(part => part.substring(1));
  
  // Check if OJ part number is included in the comprehensive scope
  // Handle both "489-52" format and "52" format
  const ojPart = ojPartNumber.includes('-') ? ojPartNumber.split('-').pop() : ojPartNumber;
  
  return includedParts.includes(ojPart);
}

// Load scopes dynamically from MD files
async function loadScopesFromMD(certType) {
  try {
    console.log(`Loading MD file for certType: ${certType}`);
    console.log(`Current working directory: ${process.cwd()}`);
    console.log(`Function directory: ${__dirname}`);
    
    // List contents of function directory and parent directories
    try {
      console.log(`Contents of __dirname (${__dirname}):`, fs.readdirSync(__dirname));
      const parentDir = path.join(__dirname, '..');
      console.log(`Contents of parent (${parentDir}):`, fs.readdirSync(parentDir));
      const grandParentDir = path.join(__dirname, '../..');
      console.log(`Contents of grandparent (${grandParentDir}):`, fs.readdirSync(grandParentDir));
      
      // Check if static directory exists
      const staticDir = path.join(__dirname, '../../static');
      if (fs.existsSync(staticDir)) {
        console.log(`Contents of static (${staticDir}):`, fs.readdirSync(staticDir));
        const dataDir = path.join(staticDir, 'data');
        if (fs.existsSync(dataDir)) {
          console.log(`Contents of data (${dataDir}):`, fs.readdirSync(dataDir));
        }
      }
    } catch (listError) {
      console.error('Error listing directories:', listError);
    }
    
    // Try multiple possible paths for Netlify deployment
    const possiblePaths = [
      path.join(__dirname, '../../static/data', `${certType}-scopes.md`),
      path.join(process.cwd(), 'static/data', `${certType}-scopes.md`),
      path.join(process.cwd(), 'static', 'data', `${certType}-scopes.md`),
      `/var/task/static/data/${certType}-scopes.md`,
      `./static/data/${certType}-scopes.md`
    ];

    console.log('Possible paths to check:', possiblePaths);

    let mdFilePath = null;
    for (const testPath of possiblePaths) {
      console.log(`Checking path: ${testPath}`);
      if (fs.existsSync(testPath)) {
        mdFilePath = testPath;
        console.log(`Found MD file at: ${mdFilePath}`);
        break;
      } else {
        console.log(`Path does not exist: ${testPath}`);
      }
    }

    if (!mdFilePath) {
      console.error(`MD file not found: ${certType}-scopes.md`);
      console.error('Checked all paths, none exist');
      throw new Error(`MD file not found: ${certType}-scopes.md`);
    }

    const mdContent = fs.readFileSync(mdFilePath, 'utf-8');
    console.log(`MD file content length: ${mdContent.length} characters`);
    console.log(`MD file first 200 chars: ${mdContent.substring(0, 200)}...`);
    
    const scopeData = parseMDToScopeData(mdContent, certType);
    
    console.log(`Loaded ${scopeData.scopes.length} scopes from ${certType}-scopes.md`);
    console.log(`Sample parsed scopes:`, scopeData.scopes.slice(0, 3));
    return scopeData.scopes;

  } catch (error) {
    console.error(`Error loading MD file for ${certType}:`, error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
    
    // TESTING ONLY: Return minimal test data as fallback for debugging
    // TODO: Remove this fallback before production deployment
    if (process.env.NODE_ENV === 'development' || process.env.NETLIFY_DEV === 'true') {
      console.warn(`[DEBUG ONLY] Returning fallback test data for ${certType} - REMOVE BEFORE PRODUCTION`);
      return [
        {
          standard: 'EN 55032',
          description: 'Test standard - EMC of multimedia equipment',
          anchor: '#test-anchor',
          facility: null
        },
        {
          standard: 'EN 301 489-52',
          description: 'Test standard - ERM Part 52',
          anchor: '#test-anchor-2',
          facility: null
        }
      ];
    }
    
    // Production behavior: return empty array
    return [];
  }
}

// Parse markdown content into structured scope data
function parseMDToScopeData(mdContent, certType) {
  const lines = mdContent.split('\n');
  console.log(`Parsing MD content: ${lines.length} lines for ${certType}`);
  
  const scopeData = {
    scopes: []
  };

  let currentCategory = null;
  let currentAnchor = null;
  let currentFacility = null;
  let inMetadata = true;
  let standardsFound = 0;

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

    // Parse section headers with anchors (both h2 and h3)
    if ((line.startsWith('### ') || line.startsWith('## ')) && line.includes('{#')) {
      const match = line.match(/^##+ (.+) \{#([^}]+)\}/);
      if (match) {
        currentCategory = match[1];
        currentAnchor = `#${match[2]}`;
        console.log(`Parsed anchor for ${certType}: ${currentAnchor} (category: ${currentCategory})`);
        continue;
      }
    }

    // Parse standard entries (lines starting with - **)
    if (line.startsWith('- **') && line.includes('**')) {
      const match = line.match(/- \*\*([^*]+)\*\*\s*-?\s*(.*)/);
      if (match) {
        const standard = match[1].trim();
        const description = match[2].trim();
        standardsFound++;
        
        if (standardsFound <= 3) {
          console.log(`Found standard ${standardsFound}: "${standard}" with description: "${description}"`);
        }
        
        scopeData.scopes.push({
          standard: standard,
          description: description,
          anchor: currentAnchor,
          facility: currentFacility
        });
      }
    }
  }

  console.log(`MD parsing complete for ${certType}: found ${standardsFound} total standards`);
  return scopeData;
}