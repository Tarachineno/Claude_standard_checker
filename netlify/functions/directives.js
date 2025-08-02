// Get available directives - Netlify Function
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const directives = [
    {
      code: 'RED',
      name: 'Radio Equipment Directive',
      description: 'Directive 2014/53/EU on radio equipment'
    },
    {
      code: 'EMC',
      name: 'Electromagnetic Compatibility Directive', 
      description: 'Directive 2014/30/EU on electromagnetic compatibility'
    },
    {
      code: 'LVD',
      name: 'Low Voltage Directive',
      description: 'Directive 2014/35/EU on low voltage electrical equipment'
    }
  ];

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      data: directives
    })
  };
};