// Download Excel file - Netlify Function
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Excel URLs for each directive
const EXCEL_URLS = {
  EMC: 'https://ec.europa.eu/docsroom/documents/51315/attachments/1/translations/en/renditions/native',
  RED: 'https://ec.europa.eu/docsroom/documents/64475/attachments/1/translations/en/renditions/native',
  LVD: 'https://ec.europa.eu/docsroom/documents/62995/attachments/1/translations/en/renditions/native'
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const directive = event.queryStringParameters?.directive;
    
    if (!directive || !EXCEL_URLS[directive]) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Invalid directive code. Use EMC, RED, or LVD.'
        })
      };
    }

    console.log(`Downloading Excel file for ${directive} directive`);

    // Download the Excel file
    const response = await axios.get(EXCEL_URLS[directive], {
      timeout: 30000,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    console.log(`Excel file downloaded for ${directive}, size: ${response.data.length} bytes`);

    // Return the Excel file as downloadable content
    const filename = `EU_Harmonised_Standards_${directive}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': response.data.length.toString()
      },
      body: Buffer.from(response.data).toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    console.error('Error downloading Excel file:', error);
    
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: `Failed to download Excel file: ${error.message}`
      })
    };
  }
};