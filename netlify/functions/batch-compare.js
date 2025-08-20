// Batch compare ISO17025 standards with all directives - Netlify Function

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
        const compareResponse = await axios.post(`${process.env.URL}/.netlify/functions/compare`, {
          directive: directive,
          iso_standards: iso_standards
        }, {
          timeout: 15000,
          headers: { 'Content-Type': 'application/json' }
        });

        if (compareResponse.data.success) {
          const comparison = compareResponse.data.data;
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