// Scope matching function for ISO17025 certificates
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
    const { oj_standards } = requestData;

    if (!oj_standards || !Array.isArray(oj_standards)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing or invalid oj_standards array'
        })
      };
    }

    // Load certificate scope data
    const a2laScopes = getA2LAScopes();
    const jabScopes = getJABScopes();

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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          matches: matchResults,
          total_standards: oj_standards.length,
          a2la_matches: matchResults.filter(r => r.scope_matches.a2la.status !== 'no_match').length,
          jab_matches: matchResults.filter(r => r.scope_matches.jab.status !== 'no_match').length
        }
      })
    };

  } catch (error) {
    console.error('Scope matching error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: `Scope matching failed: ${error.message}`
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

  // Try to find matches in certificate scopes
  for (const scope of certificateScopes) {
    const scopeCore = extractStandardCore(scope.standard);
    const scopeVersion = extractVersion(scope.standard);

    if (ojCore === scopeCore) {
      // Core numbers match, check version/prefix differences
      
      if (ojStandard === scope.standard) {
        // Exact match
        return {
          status: 'exact_match',
          matched_standard: scope.standard,
          note: null,
          anchor: scope.anchor,
          facility: scope.facility || null
        };
      }
      
      if (ojVersion && scopeVersion && ojVersion !== scopeVersion) {
        // Version difference
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
  }

  return {
    status: 'no_match',
    matched_standard: null,
    note: null,
    anchor: null
  };
}

// A2LA scope data
function getA2LAScopes() {
  return [
    // Radiated & Conducted
    { standard: 'CFR 47 FCC Part 15B (ANSI C63.4:2014)', anchor: '#radiated-conducted' },
    { standard: 'FCC Part 18 (MP-5:1986)', anchor: '#radiated-conducted' },
    { standard: 'FCC Parts 15C (ANSI C63.10:2013)', anchor: '#radiated-conducted' },
    { standard: 'FCC Part 15E (ANSI C63.10:2013 & FCC KDB 905462 D02 v02)', anchor: '#radiated-conducted' },
    { standard: 'FCC Parts 15F (ANSI C63.10:2013)', anchor: '#radiated-conducted' },
    { standard: 'UNII-MP', anchor: '#radiated-conducted' },
    { standard: 'CISPR 11', anchor: '#radiated-conducted' },
    { standard: 'EN 55011', anchor: '#radiated-conducted' },
    { standard: 'KS C 9811', anchor: '#radiated-conducted' },
    { standard: 'IEC 61000-6-4', anchor: '#radiated-conducted' },
    { standard: 'EN 61000-6-4', anchor: '#radiated-conducted' },
    { standard: 'KS C 9610-6-4', anchor: '#radiated-conducted' },
    
    // European Radio
    { standard: 'ETSI EN 301 091-1/-2/-3', anchor: '#european-radio' },
    { standard: 'EN 301 783', anchor: '#european-radio' },
    { standard: 'EN 301 893', anchor: '#european-radio' },
    { standard: 'EN 302 065-1/-2/-3/-4', anchor: '#european-radio' },
    { standard: 'EN 302 264', anchor: '#european-radio' },
    { standard: 'EN 305 550-1/-2', anchor: '#european-radio' },
    { standard: 'EN 300 328', anchor: '#european-radio' },
    { standard: 'EN 300 330', anchor: '#european-radio' },
    { standard: 'EN 300 220-1/-2', anchor: '#european-radio' },
    { standard: 'EN 303 413', anchor: '#european-radio' },
    
    // Emissions for Ports
    { standard: 'CISPR 32', anchor: '#emissions-for-ports' },
    { standard: 'EN 55032', anchor: '#emissions-for-ports' },
    
    // Harmonic Current Emissions
    { standard: 'IEC 61000-3-2', anchor: '#harmonic-current-emissions' },
    { standard: 'EN 61000-3-2', anchor: '#harmonic-current-emissions' },
    
    // Voltage Fluctuations & Flicker
    { standard: 'IEC 61000-3-3', anchor: '#voltage-fluctuations-flicker' },
    { standard: 'EN 61000-3-3', anchor: '#voltage-fluctuations-flicker' },
    { standard: 'IEC 61000-3-11', anchor: '#voltage-fluctuations-flicker' },
    { standard: 'EN 61000-3-11', anchor: '#voltage-fluctuations-flicker' },
    
    // Electrostatic Discharge (ESD)
    { standard: 'IEC 61000-4-2', anchor: '#electrostatic-discharge' },
    { standard: 'EN 61000-4-2', anchor: '#electrostatic-discharge' },
    { standard: 'KS C 9610-4-2', anchor: '#electrostatic-discharge' },
    
    // RF Radiated EM Field Immunity
    { standard: 'IEC 61000-4-3', anchor: '#rf-radiated-immunity' },
    { standard: 'EN 61000-4-3', anchor: '#rf-radiated-immunity' },
    { standard: 'KS C 9610-4-3', anchor: '#rf-radiated-immunity' },
    
    // Electrical Fast/Transient Burst (EFT)
    { standard: 'IEC 61000-4-4', anchor: '#electrical-fast-transient' },
    { standard: 'EN 61000-4-4', anchor: '#electrical-fast-transient' },
    { standard: 'KS C 9610-4-4', anchor: '#electrical-fast-transient' },
    
    // Surge
    { standard: 'IEC 61000-4-5', anchor: '#surge' },
    { standard: 'EN 61000-4-5', anchor: '#surge' },
    { standard: 'KS C 9610-4-5', anchor: '#surge' },
    
    // Conducted Immunity
    { standard: 'IEC 61000-4-6', anchor: '#conducted-immunity' },
    { standard: 'EN 61000-4-6', anchor: '#conducted-immunity' },
    { standard: 'KS C 9610-4-6', anchor: '#conducted-immunity' },
    
    // Transients & Surges (Vehicle)
    { standard: 'ISO 7637-2', anchor: '#vehicle-transients' },
    
    // Magnetic Field Immunity
    { standard: 'IEC 61000-4-8', anchor: '#magnetic-field-immunity' },
    { standard: 'EN 61000-4-8', anchor: '#magnetic-field-immunity' },
    { standard: 'KS C 9610-4-8', anchor: '#magnetic-field-immunity' },
    
    // Voltage Dips/Interruptions/Variations
    { standard: 'IEC 61000-4-11', anchor: '#voltage-dips-interruptions' },
    { standard: 'EN 61000-4-11', anchor: '#voltage-dips-interruptions' },
    { standard: 'KS C 9610-4-11', anchor: '#voltage-dips-interruptions' },
    { standard: 'KS C IEC 61000-4-34', anchor: '#voltage-dips-interruptions' },
    { standard: 'IEC 61000-4-34', anchor: '#voltage-dips-interruptions' },
    { standard: 'EN 61000-4-34', anchor: '#voltage-dips-interruptions' },
    
    // Generic Immunity – Industrial Environments
    { standard: 'IEC 61000-6-2', anchor: '#generic-immunity-industrial' },
    { standard: 'EN 61000-6-2', anchor: '#generic-immunity-industrial' },
    { standard: 'KS C 9610-6-2', anchor: '#generic-immunity-industrial' },
    
    // Product Family Standards
    { standard: 'EN 50370-11', anchor: '#product-family-standards' },
    { standard: 'EN 50370-21', anchor: '#product-family-standards' },
    { standard: 'EN 301 489-1/-3/-7/-9/-15/-17/-19/-24/-51/-52', anchor: '#product-family-standards' }
  ];
}

// JAB scope data
function getJABScopes() {
  return [
    // Facility 1: SGS Japan Inc. Kitayamata Laboratory
    // Continuous Disturbance Tests
    { standard: 'EN 55011', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 55022:2010', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'IEC 60945', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 60945', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 61326-1', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'IEC 61326-1', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'IEC 61000-6-3', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 61000-6-3', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'IEC 61000-6-4', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 61000-6-4', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 489-1', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 489-3', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 489-7', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 489-9', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 489-15', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 489-17', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 489-19', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 489-24', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 489-51', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 489-52', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 843-1', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 301 843-2', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'IEC 60601-1-2', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 60601-1-2', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'JIS T 0601-1-2', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'CISPR11', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'VCCI rule V-3', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'VCCI-CISPR 32', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'CISPR32', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN55032', anchor: '#facility-1-continuous-disturbance', facility: '施設1: SGS Japan Inc.' },
    
    // Vehicle EMC Tests
    { standard: 'CISPR 25', anchor: '#facility-1-vehicle-emc', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 55025', anchor: '#facility-1-vehicle-emc', facility: '施設1: SGS Japan Inc.' },
    { standard: 'ISO 13766-1', anchor: '#facility-1-vehicle-emc', facility: '施設1: SGS Japan Inc.' },
    { standard: 'ISO 7637-2', anchor: '#facility-1-vehicle-emc', facility: '施設1: SGS Japan Inc.' },
    
    // Harmonic Current Emission Tests
    { standard: 'IEC 61000-3-2', anchor: '#facility-1-harmonic-current', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 61000-3-2', anchor: '#facility-1-harmonic-current', facility: '施設1: SGS Japan Inc.' },
    
    // Voltage Fluctuation & Flicker Tests
    { standard: 'IEC 61000-3-3', anchor: '#facility-1-voltage-fluctuation', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 61000-3-3', anchor: '#facility-1-voltage-fluctuation', facility: '施設1: SGS Japan Inc.' },
    
    // ESD Tests
    { standard: 'EN 55024', anchor: '#facility-1-esd', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 55035', anchor: '#facility-1-esd', facility: '施設1: SGS Japan Inc.' },
    { standard: 'CISPR35', anchor: '#facility-1-esd', facility: '施設1: SGS Japan Inc.' },
    { standard: 'IEC 61000-4-2', anchor: '#facility-1-esd', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 61000-4-2', anchor: '#facility-1-esd', facility: '施設1: SGS Japan Inc.' },
    { standard: 'JIS C 61000-4-2', anchor: '#facility-1-esd', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 61000-6-1', anchor: '#facility-1-esd', facility: '施設1: SGS Japan Inc.' },
    { standard: 'IEC 61000-6-1', anchor: '#facility-1-esd', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 61000-6-2', anchor: '#facility-1-esd', facility: '施設1: SGS Japan Inc.' },
    { standard: 'IEC 61000-6-2', anchor: '#facility-1-esd', facility: '施設1: SGS Japan Inc.' },
    
    // RF Radiated Tests
    { standard: 'IEC 61000-4-3', anchor: '#facility-1-rf-radiated', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 61000-4-3', anchor: '#facility-1-rf-radiated', facility: '施設1: SGS Japan Inc.' },
    { standard: 'JIS C 61000-4-3', anchor: '#facility-1-rf-radiated', facility: '施設1: SGS Japan Inc.' },
    
    // Electrical Fast Transient Tests
    { standard: 'IEC 61000-4-4', anchor: '#facility-1-electrical-fast-transient', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 61000-4-4', anchor: '#facility-1-electrical-fast-transient', facility: '施設1: SGS Japan Inc.' },
    { standard: 'JIS C 61000-4-4', anchor: '#facility-1-electrical-fast-transient', facility: '施設1: SGS Japan Inc.' },
    
    // Surge Immunity Tests
    { standard: 'IEC 61000-4-5', anchor: '#facility-1-surge-immunity', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 61000-4-5', anchor: '#facility-1-surge-immunity', facility: '施設1: SGS Japan Inc.' },
    { standard: 'JIS C 61000-4-5', anchor: '#facility-1-surge-immunity', facility: '施設1: SGS Japan Inc.' },
    
    // RF Conducted Tests
    { standard: 'IEC 61000-4-6', anchor: '#facility-1-rf-conducted', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 61000-4-6', anchor: '#facility-1-rf-conducted', facility: '施設1: SGS Japan Inc.' },
    { standard: 'JIS C 61000-4-6', anchor: '#facility-1-rf-conducted', facility: '施設1: SGS Japan Inc.' },
    
    // Magnetic Field Tests
    { standard: 'IEC 61000-4-8', anchor: '#facility-1-magnetic-field', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 61000-4-8', anchor: '#facility-1-magnetic-field', facility: '施設1: SGS Japan Inc.' },
    { standard: 'JIS C 61000-4-8', anchor: '#facility-1-magnetic-field', facility: '施設1: SGS Japan Inc.' },
    
    // Power Supply Fluctuation Tests
    { standard: 'IEC 61000-4-11', anchor: '#facility-1-power-supply-fluctuation', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 61000-4-11', anchor: '#facility-1-power-supply-fluctuation', facility: '施設1: SGS Japan Inc.' },
    { standard: 'JIS C 61000-4-11', anchor: '#facility-1-power-supply-fluctuation', facility: '施設1: SGS Japan Inc.' },
    { standard: 'IEC 61000-4-34', anchor: '#facility-1-power-supply-fluctuation', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 61000-4-34', anchor: '#facility-1-power-supply-fluctuation', facility: '施設1: SGS Japan Inc.' },
    { standard: 'JIS C 61000-4-34', anchor: '#facility-1-power-supply-fluctuation', facility: '施設1: SGS Japan Inc.' },
    
    // Vehicle Immunity Tests
    { standard: 'ISO 11452-2', anchor: '#facility-1-vehicle-immunity', facility: '施設1: SGS Japan Inc.' },
    { standard: 'ISO 11452-3', anchor: '#facility-1-vehicle-immunity', facility: '施設1: SGS Japan Inc.' },
    { standard: 'ISO 11452-4', anchor: '#facility-1-vehicle-immunity', facility: '施設1: SGS Japan Inc.' },
    { standard: 'ISO 11452-8', anchor: '#facility-1-vehicle-immunity', facility: '施設1: SGS Japan Inc.' },
    { standard: 'ISO 11452-9', anchor: '#facility-1-vehicle-immunity', facility: '施設1: SGS Japan Inc.' },
    { standard: 'ISO 7637-2(2004)', anchor: '#facility-1-vehicle-immunity', facility: '施設1: SGS Japan Inc.' },
    { standard: 'ISO 7637-3', anchor: '#facility-1-vehicle-immunity', facility: '施設1: SGS Japan Inc.' },
    { standard: 'ISO 10605', anchor: '#facility-1-vehicle-immunity', facility: '施設1: SGS Japan Inc.' },
    
    // Close Proximity Tests
    { standard: 'IEC 61000-4-39', anchor: '#facility-1-close-proximity', facility: '施設1: SGS Japan Inc.' },
    { standard: 'EN 61000-4-39', anchor: '#facility-1-close-proximity', facility: '施設1: SGS Japan Inc.' },
    
    // Facility 2: TDK Corporation - Continuous Disturbance Tests
    { standard: 'EN 55011', anchor: '#facility-2-continuous-disturbance', facility: '施設2: TDK Corporation' },
    { standard: 'EN 55022:2010', anchor: '#facility-2-continuous-disturbance', facility: '施設2: TDK Corporation' },
    { standard: 'IEC 60945', anchor: '#facility-2-continuous-disturbance', facility: '施設2: TDK Corporation' },
    { standard: 'EN 60945', anchor: '#facility-2-continuous-disturbance', facility: '施設2: TDK Corporation' },
    { standard: 'EN 61326-1', anchor: '#facility-2-continuous-disturbance', facility: '施設2: TDK Corporation' },
    { standard: 'IEC 61326-1', anchor: '#facility-2-continuous-disturbance', facility: '施設2: TDK Corporation' },
    { standard: 'IEC 61000-6-3', anchor: '#facility-2-continuous-disturbance', facility: '施設2: TDK Corporation' },
    { standard: 'EN 61000-6-3', anchor: '#facility-2-continuous-disturbance', facility: '施設2: TDK Corporation' },
    { standard: 'IEC 61000-6-4', anchor: '#facility-2-continuous-disturbance', facility: '施設2: TDK Corporation' },
    { standard: 'EN 61000-6-4', anchor: '#facility-2-continuous-disturbance', facility: '施設2: TDK Corporation' },
    { standard: 'IEC 60601-1-2', anchor: '#facility-2-continuous-disturbance', facility: '施設2: TDK Corporation' },
    { standard: 'EN 60601-1-2', anchor: '#facility-2-continuous-disturbance', facility: '施設2: TDK Corporation' },
    { standard: 'JIS T 0601-1-2', anchor: '#facility-2-continuous-disturbance', facility: '施設2: TDK Corporation' },
    { standard: 'CISPR11', anchor: '#facility-2-continuous-disturbance', facility: '施設2: TDK Corporation' },
    { standard: 'VCCI rule V-3', anchor: '#facility-2-continuous-disturbance', facility: '施設2: TDK Corporation' },
    { standard: 'VCCI-CISPR 32', anchor: '#facility-2-continuous-disturbance', facility: '施設2: TDK Corporation' },
    { standard: 'CISPR32', anchor: '#facility-2-continuous-disturbance', facility: '施設2: TDK Corporation' },
    { standard: 'EN55032', anchor: '#facility-2-continuous-disturbance', facility: '施設2: TDK Corporation' },
    { standard: 'EN 12015', anchor: '#facility-2-continuous-disturbance', facility: '施設2: TDK Corporation' },
    { standard: 'EN 301 489-1', anchor: '#facility-2-continuous-disturbance', facility: '施設2: TDK Corporation' },
    { standard: 'EN 301 489-3', anchor: '#facility-2-continuous-disturbance', facility: '施設2: TDK Corporation' },
    
    // Facility 2: Discontinuous Disturbance Tests
    { standard: 'EN 12015', anchor: '#facility-2-discontinuous-disturbance', facility: '施設2: TDK Corporation' },
    
    // Facility 2: Radio Tests
    { standard: 'EN 300 330', anchor: '#facility-2-radio-transmitter', facility: '施設2: TDK Corporation' },
    { standard: 'EN 300 330', anchor: '#facility-2-radio-receiver', facility: '施設2: TDK Corporation' }
  ];
}