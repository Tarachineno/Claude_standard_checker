// Get available directives - Netlify Function
const fs = require('fs').promises;
const path = require('path');

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

  try {
    // Read directives from static file
    const directivesPath = path.join(process.cwd(), 'static', 'api', 'directives.json');
    const directivesData = await fs.readFile(directivesPath, 'utf8');
    const directivesJson = JSON.parse(directivesData);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(directivesJson)
    };
  } catch (error) {
    console.error('Error reading directives:', error);
    
    // Fallback to hardcoded directives
    const directives = [
      {
        code: 'RED',
        name: 'Radio Equipment Directive',
        description: 'Directive 2014/53/EU on radio equipment',
        directive_number: '2014/53/EU',
        excel_url: 'https://ec.europa.eu/docsroom/documents/64475/attachments/1/translations/en/renditions/native'
      },
      {
        code: 'EMC',
        name: 'Electromagnetic Compatibility Directive', 
        description: 'Directive 2014/30/EU on electromagnetic compatibility',
        directive_number: '2014/30/EU',
        excel_url: 'https://ec.europa.eu/docsroom/documents/51315/attachments/1/translations/en/renditions/native'
      },
      {
        code: 'LVD',
        name: 'Low Voltage Directive',
        description: 'Directive 2014/35/EU on low voltage electrical equipment',
        directive_number: '2014/35/EU',
        excel_url: 'https://ec.europa.eu/docsroom/documents/62995/attachments/1/translations/en/renditions/native'
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
  }
};