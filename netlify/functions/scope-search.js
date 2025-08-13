// Scope search function for ISO17025 certificates
const { loadFileContent, parseMDToScopeData } = require('./utils/md');

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
    const filename = `${certType}-scopes.md`;
    const mdContent = await loadFileContent(filename, 'data');
    
    const scopeData = parseMDToScopeData(mdContent, certType);
    
    console.log(`Loaded ${scopeData.scopes.length} scopes from ${filename}`);
    return scopeData.scopes;

  } catch (error) {
    console.error(`Error loading MD file for ${certType}:`, error);
    return [];
  }
}

