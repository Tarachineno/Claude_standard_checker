// No external dependencies needed for mock data

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

  try {
    const directive = event.path.split('/').pop();
    console.log('Fetching standards for directive:', directive);

    // Mock data for now - can be replaced with real API calls later
    const mockData = {
      RED: {
        directive: 'RED',
        directive_name: 'Radio Equipment Directive',
        standards: [
          {
            number: 'EN 301 489-1',
            title: 'ElectroMagnetic Compatibility (EMC) standard for radio equipment',
            version: 'V2.2.3',
            date: '2019-11-05',
            type: 'Harmonised Standard'
          },
          {
            number: 'EN 301 489-17',
            title: 'EMC standard for Broadband Data Transmission Systems',
            version: 'V3.2.4',
            date: '2020-09-11', 
            type: 'Harmonised Standard'
          }
        ],
        count: 2
      },
      EMC: {
        directive: 'EMC',
        directive_name: 'Electromagnetic Compatibility Directive',
        standards: [
          {
            number: 'EN 55032',
            title: 'Electromagnetic compatibility of multimedia equipment - Emission requirements',
            version: '2015',
            date: '2015-03-01',
            type: 'Harmonised Standard'
          }
        ],
        count: 1
      },
      LVD: {
        directive: 'LVD',
        directive_name: 'Low Voltage Directive',
        standards: [
          {
            number: 'EN 60950-1',
            title: 'Information technology equipment - Safety',
            version: '2006',
            date: '2006-01-01',
            type: 'Harmonised Standard'
          }
        ],
        count: 1
      }
    };

    const data = mockData[directive];
    
    if (!data) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid directive code'
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: data
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};