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
    const mdFilePath = path.join(__dirname, '../../static/data', `${certType}-scopes.md`);
    
    if (!fs.existsSync(mdFilePath)) {
      console.warn(`MD file not found: ${certType}-scopes.md, falling back to hardcoded data`);
      return certType === 'a2la' ? getA2LAScopes() : getJABScopes();
    }

    const mdContent = fs.readFileSync(mdFilePath, 'utf-8');
    const scopeData = parseMDToScopeData(mdContent, certType);
    
    console.log(`Loaded ${scopeData.scopes.length} scopes from ${certType}-scopes.md`);
    return scopeData.scopes;
    
  } catch (error) {
    console.error(`Error loading MD file for ${certType}:`, error);
    // Fallback to hardcoded data
    return certType === 'a2la' ? getA2LAScopes() : getJABScopes();
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

// A2LA scope data (same as in scope-matcher.js but with descriptions)
function getA2LAScopes() {
  return [
    // Radiated & Conducted
    { standard: 'CFR 47 FCC Part 15B (ANSI C63.4:2014)', description: 'Unintentional Radiators', anchor: '#radiated-conducted' },
    { standard: 'FCC Part 18 (MP-5:1986)', description: 'Industrial, Scientific, and Medical Equipment', anchor: '#radiated-conducted' },
    { standard: 'FCC Parts 15C (ANSI C63.10:2013)', description: 'Intentional Radiators', anchor: '#radiated-conducted' },
    { standard: 'FCC Part 15E (ANSI C63.10:2013 & FCC KDB 905462 D02 v02)', description: 'U-NII Equipment', anchor: '#radiated-conducted' },
    { standard: 'FCC Parts 15F (ANSI C63.10:2013)', description: 'Ultra-Wideband Operation', anchor: '#radiated-conducted' },
    { standard: 'UNII-MP', description: 'Unlicensed National Information Infrastructure', anchor: '#radiated-conducted' },
    { standard: 'CISPR 11', description: 'Industrial, scientific and medical equipment', anchor: '#radiated-conducted' },
    { standard: 'EN 55011', description: 'Industrial, scientific and medical equipment', anchor: '#radiated-conducted' },
    { standard: 'KS C 9811', description: 'Korean EMC Standard', anchor: '#radiated-conducted' },
    { standard: 'IEC 61000-6-4', description: 'Generic emission standard for industrial environments', anchor: '#radiated-conducted' },
    { standard: 'EN 61000-6-4', description: 'Generic emission standard for industrial environments', anchor: '#radiated-conducted' },
    { standard: 'KS C 9610-6-4', description: 'Korean generic emission standard', anchor: '#radiated-conducted' },
    
    // European Radio
    { standard: 'ETSI EN 301 091-1/-2/-3', description: 'Electromagnetic compatibility and Radio spectrum Matters (ERM)', anchor: '#european-radio' },
    { standard: 'EN 301 783', description: 'Land Mobile Service', anchor: '#european-radio' },
    { standard: 'EN 301 893', description: '5 GHz high performance RLAN', anchor: '#european-radio' },
    { standard: 'EN 302 065-1/-2/-3/-4', description: 'Short Range Devices', anchor: '#european-radio' },
    { standard: 'EN 302 264', description: 'Meteor Burst Communications', anchor: '#european-radio' },
    { standard: 'EN 305 550-1/-2', description: 'Direct Sequence Spread Spectrum (DSSS)', anchor: '#european-radio' },
    { standard: 'EN 300 328', description: '2,4 GHz wideband transmission systems', anchor: '#european-radio' },
    { standard: 'EN 300 330', description: 'Short Range Devices', anchor: '#european-radio' },
    { standard: 'EN 300 220-1/-2', description: 'Short Range Devices', anchor: '#european-radio' },
    { standard: 'EN 303 413', description: 'Satellite Earth Stations and Systems', anchor: '#european-radio' },
    
    // Emissions for Ports
    { standard: 'CISPR 32', description: 'Electromagnetic compatibility of multimedia equipment', anchor: '#emissions-for-ports' },
    { standard: 'EN 55032', description: 'Electromagnetic compatibility of multimedia equipment', anchor: '#emissions-for-ports' },
    
    // Harmonic Current Emissions
    { standard: 'IEC 61000-3-2', description: 'Limits for harmonic current emissions', anchor: '#harmonic-current-emissions' },
    { standard: 'EN 61000-3-2', description: 'Limits for harmonic current emissions', anchor: '#harmonic-current-emissions' },
    
    // Voltage Fluctuations & Flicker
    { standard: 'IEC 61000-3-3', description: 'Voltage fluctuations and flicker', anchor: '#voltage-fluctuations-flicker' },
    { standard: 'EN 61000-3-3', description: 'Voltage fluctuations and flicker', anchor: '#voltage-fluctuations-flicker' },
    { standard: 'IEC 61000-3-11', description: 'Voltage fluctuations and flicker', anchor: '#voltage-fluctuations-flicker' },
    { standard: 'EN 61000-3-11', description: 'Voltage fluctuations and flicker', anchor: '#voltage-fluctuations-flicker' },
    
    // Electrostatic Discharge (ESD)
    { standard: 'IEC 61000-4-2', description: 'Electrostatic discharge immunity test', anchor: '#electrostatic-discharge' },
    { standard: 'EN 61000-4-2', description: 'Electrostatic discharge immunity test', anchor: '#electrostatic-discharge' },
    { standard: 'KS C 9610-4-2', description: 'Korean ESD immunity test', anchor: '#electrostatic-discharge' },
    
    // RF Radiated EM Field Immunity
    { standard: 'IEC 61000-4-3', description: 'Radiated electromagnetic field immunity test', anchor: '#rf-radiated-immunity' },
    { standard: 'EN 61000-4-3', description: 'Radiated electromagnetic field immunity test', anchor: '#rf-radiated-immunity' },
    { standard: 'KS C 9610-4-3', description: 'Korean RF radiated immunity test', anchor: '#rf-radiated-immunity' },
    
    // Electrical Fast/Transient Burst (EFT)
    { standard: 'IEC 61000-4-4', description: 'Electrical fast transient immunity test', anchor: '#electrical-fast-transient' },
    { standard: 'EN 61000-4-4', description: 'Electrical fast transient immunity test', anchor: '#electrical-fast-transient' },
    { standard: 'KS C 9610-4-4', description: 'Korean electrical fast transient immunity test', anchor: '#electrical-fast-transient' },
    
    // Surge
    { standard: 'IEC 61000-4-5', description: 'Surge immunity test', anchor: '#surge' },
    { standard: 'EN 61000-4-5', description: 'Surge immunity test', anchor: '#surge' },
    { standard: 'KS C 9610-4-5', description: 'Korean surge immunity test', anchor: '#surge' },
    
    // Conducted Immunity
    { standard: 'IEC 61000-4-6', description: 'Conducted RF immunity test', anchor: '#conducted-immunity' },
    { standard: 'EN 61000-4-6', description: 'Conducted RF immunity test', anchor: '#conducted-immunity' },
    { standard: 'KS C 9610-4-6', description: 'Korean conducted RF immunity test', anchor: '#conducted-immunity' },
    
    // Transients & Surges (Vehicle)
    { standard: 'ISO 7637-2', description: 'Road vehicles electrical disturbances', anchor: '#vehicle-transients' },
    
    // Magnetic Field Immunity
    { standard: 'IEC 61000-4-8', description: 'Power frequency magnetic field immunity test', anchor: '#magnetic-field-immunity' },
    { standard: 'EN 61000-4-8', description: 'Power frequency magnetic field immunity test', anchor: '#magnetic-field-immunity' },
    { standard: 'KS C 9610-4-8', description: 'Korean magnetic field immunity test', anchor: '#magnetic-field-immunity' },
    
    // Voltage Dips/Interruptions/Variations
    { standard: 'IEC 61000-4-11', description: 'Voltage dips, short interruptions and voltage variations immunity test', anchor: '#voltage-dips-interruptions' },
    { standard: 'EN 61000-4-11', description: 'Voltage dips, short interruptions and voltage variations immunity test', anchor: '#voltage-dips-interruptions' },
    { standard: 'KS C 9610-4-11', description: 'Korean voltage dips immunity test', anchor: '#voltage-dips-interruptions' },
    { standard: 'KS C IEC 61000-4-34', description: 'Korean voltage dips and interruptions test', anchor: '#voltage-dips-interruptions' },
    { standard: 'IEC 61000-4-34', description: 'Voltage dips, short interruptions and voltage variations test', anchor: '#voltage-dips-interruptions' },
    { standard: 'EN 61000-4-34', description: 'Voltage dips, short interruptions and voltage variations test', anchor: '#voltage-dips-interruptions' },
    
    // Generic Immunity – Industrial Environments
    { standard: 'IEC 61000-6-2', description: 'Generic immunity standard for industrial environments', anchor: '#generic-immunity-industrial' },
    { standard: 'EN 61000-6-2', description: 'Generic immunity standard for industrial environments', anchor: '#generic-immunity-industrial' },
    { standard: 'KS C 9610-6-2', description: 'Korean generic immunity standard for industrial environments', anchor: '#generic-immunity-industrial' },
    
    // Product Family Standards
    { standard: 'EN 50370-11', description: 'Product family standard for machine tools', anchor: '#product-family-standards' },
    { standard: 'EN 50370-21', description: 'Product family standard for lifts, escalators and moving walks', anchor: '#product-family-standards' },
    { standard: 'EN 301 489-1/-3/-7/-9/-15/-17/-19/-24/-51/-52', description: 'Product family standards for radio equipment and services', anchor: '#product-family-standards' }
  ];
}

// JAB scope data (same as in scope-matcher.js but with descriptions)
function getJABScopes() {
  return [
    // Facility 1: SGS Japan Inc. Kitayamata Laboratory
    // Continuous Disturbance Tests
    { standard: 'EN 55011', description: 'Industrial, scientific and medical equipment (except 10)', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 55022:2010', description: 'Information technology equipment (except 7)', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'IEC 60945', description: 'Maritime navigation and radiocommunication equipment', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 60945', description: 'Maritime navigation and radiocommunication equipment', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 61326-1', description: 'Electrical equipment for measurement, control and laboratory use', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'IEC 61326-1', description: 'Electrical equipment for measurement, control and laboratory use', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'IEC 61000-6-3', description: 'Generic emission standard for residential environments', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 61000-6-3', description: 'Generic emission standard for residential environments', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'IEC 61000-6-4', description: 'Generic emission standard for industrial environments', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 61000-6-4', description: 'Generic emission standard for industrial environments', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 489-1', description: 'ElectroMagnetic Compatibility and Radio spectrum Matters; General', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 489-3', description: 'Short Range Devices', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 489-7', description: 'Mobile radio and fixed radio networks', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 489-9', description: 'Radio equipment with GNSS receivers', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 489-15', description: 'Radio equipment for CDMA direct spread systems', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 489-17', description: 'Wideband data transmission systems', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 489-19', description: 'IMT-2000 CDMA direct spread radio equipment', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 489-24', description: 'IMT-2000 multi-carrier radio equipment', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 489-51', description: 'LTE radio equipment', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 489-52', description: 'GSM/EDGE radio equipment', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 843-1', description: 'S-PCS radio equipment', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 843-2', description: 'S-PCS radio equipment', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'IEC 60601-1-2', description: 'Medical electrical equipment', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 60601-1-2', description: 'Medical electrical equipment', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'JIS T 0601-1-2', description: 'Japanese medical electrical equipment standard', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'CISPR11', description: 'Industrial, scientific and medical equipment (except 10)', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'VCCI rule V-3', description: 'VCCI technical conditions', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'VCCI-CISPR 32', description: 'Multimedia equipment EMC', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'CISPR32', description: 'Electromagnetic compatibility of multimedia equipment', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN55032', description: 'Electromagnetic compatibility of multimedia equipment (ITE only)', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    
    // Vehicle EMC Tests
    { standard: 'CISPR 25', description: 'Vehicles, boats and internal combustion engines', anchor: '#facility-1-vehicle-emc', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 55025', description: 'Vehicles, boats and internal combustion engines', anchor: '#facility-1-vehicle-emc', facility: '施設1: SGS Japan Inc.' },
    { standard: 'ISO 13766-1', description: 'Earth-moving machinery EMC (except bodies of construction machinery)', anchor: '#facility-1-vehicle-emc', facility: '施設1: SGS Japan Inc.' },
    { standard: 'ISO 7637-2', description: 'Road vehicles electrical disturbances', anchor: '#facility-1-vehicle-emc', facility: '施設1: SGS Japan Inc.' },
    
    // Add other JAB standards with descriptions...
    // (Similar pattern as A2LA, truncated for brevity)
    
    // ESD Tests (sample)
    { standard: 'IEC 61000-4-2', description: 'Electrostatic discharge immunity test', anchor: '#facility-1-esd', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 61000-4-2', description: 'Electrostatic discharge immunity test', anchor: '#facility-1-esd', facility: '施設1: SGS Japan Inc.' },
    { standard: 'JIS C 61000-4-2', description: 'Japanese ESD immunity test', anchor: '#facility-1-esd', facility: '施設1: SGS Japan Inc.' },
    
    // Add more as needed...
  ];
}