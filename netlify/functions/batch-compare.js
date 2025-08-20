// Batch compare ISO17025 standards with all directives - Netlify Function
const { getSiteUrl } = require('./utils/config');

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
    const { iso_standards } = JSON.parse(event.body);
    
    if (!iso_standards || !Array.isArray(iso_standards)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing or invalid ISO standards data'
        })
      };
    }

    console.log(`Batch comparing ${iso_standards.length} ISO standards with all directives`);

    const directives = ['RED', 'EMC', 'LVD'];
    const results = {};
    let bestDirective = null;
    let bestCoverage = 0;

    // Compare with each directive
    for (const directive of directives) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const compareResponse = await fetch(`${getSiteUrl()}/.netlify/functions/compare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            directive: directive,
            iso_standards: iso_standards
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!compareResponse.ok) {
          throw new Error(`HTTP ${compareResponse.status}`);
        }
        
        const responseData = await compareResponse.json();

        if (responseData.success) {
          const comparison = responseData.data;
          results[directive] = comparison;
          
          // Track best match
          if (comparison.coverage_percentage > bestCoverage) {
            bestCoverage = comparison.coverage_percentage;
            bestDirective = directive;
          }
        }
      } catch (error) {
        console.error(`Error comparing with ${directive}:`, error.message);
        
        // Add placeholder result for failed comparison
        results[directive] = {
          directive: directive,
          directive_name: getDirectiveName(directive),
          matched_standards: [],
          matched_count: 0,
          coverage_percentage: 0,
          error: 'Comparison failed'
        };
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          results: results,
          best_directive: bestDirective,
          best_coverage: bestCoverage,
          total_iso_standards: iso_standards.length,
          comparison_date: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('Batch comparison error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Batch comparison failed'
      })
    };
  }
};

function getDirectiveName(directive) {
  const names = {
    'RED': 'Radio Equipment Directive',
    'EMC': 'Electromagnetic Compatibility Directive',
    'LVD': 'Low Voltage Directive'
  };
  return names[directive] || directive;
}