// Compare ISO17025 standards with OJ standards - Netlify Function
const axios = require('axios');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const { directive, iso_standards } = JSON.parse(event.body);
    
    if (!directive || !iso_standards) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing directive or ISO standards data'
        })
      };
    }

    console.log(`Comparing ${iso_standards.length} ISO standards with ${directive} directive`);

    // Get OJ standards for the directive
    const ojResponse = await axios.get(`${process.env.URL}/.netlify/functions/standards?directive=${directive}`, {
      timeout: 10000
    });

    if (!ojResponse.data.success) {
      throw new Error('Failed to fetch OJ standards');
    }

    const ojStandards = ojResponse.data.data.standards;
    const comparison = compareStandards(ojStandards, iso_standards, directive);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: comparison
      })
    };

  } catch (error) {
    console.error('Comparison error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Comparison failed'
      })
    };
  }
};

function compareStandards(ojStandards, isoStandards, directive) {
  const matchedStandards = [];
  const ojOnlyStandards = [];
  const isoOnlyStandards = [...isoStandards];

  // Find matches
  ojStandards.forEach(ojStandard => {
    const match = isoStandards.find(isoStandard => 
      normalizeStandardNumber(ojStandard.number) === normalizeStandardNumber(isoStandard.standard_number)
    );

    if (match) {
      matchedStandards.push({
        oj_standard: ojStandard,
        iso_standard: match
      });
      
      // Remove from ISO-only list
      const index = isoOnlyStandards.findIndex(iso => 
        normalizeStandardNumber(iso.standard_number) === normalizeStandardNumber(match.standard_number)
      );
      if (index > -1) {
        isoOnlyStandards.splice(index, 1);
      }
    } else {
      ojOnlyStandards.push(ojStandard);
    }
  });

  // Calculate coverage percentage
  const coveragePercentage = isoStandards.length > 0 
    ? (matchedStandards.length / isoStandards.length) * 100 
    : 0;

  return {
    directive: directive,
    directive_name: getDirectiveName(directive),
    matched_standards: matchedStandards,
    matched_count: matchedStandards.length,
    oj_only_standards: ojOnlyStandards,
    iso_only_standards: isoOnlyStandards,
    oj_count: ojStandards.length,
    iso_count: isoStandards.length,
    coverage_percentage: coveragePercentage,
    comparison_date: new Date().toISOString()
  };
}

function normalizeStandardNumber(number) {
  // Remove extra spaces, convert to uppercase, remove version info
  return number.trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/V\d+\.\d+\.\d+.*$/, '')
    .replace(/:\d+.*$/, '')
    .trim();
}

function getDirectiveName(directive) {
  const names = {
    'RED': 'Radio Equipment Directive',
    'EMC': 'Electromagnetic Compatibility Directive',
    'LVD': 'Low Voltage Directive'
  };
  return names[directive] || directive;
}