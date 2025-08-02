// Upload and process ISO17025 certificate - Netlify Function
// Demo mode - returns mock data for demonstration purposes

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
    // For demo purposes, always return mock certificate data
    // In a production environment, you would implement actual PDF parsing
    console.log('Certificate upload received - returning demo data');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: getMockCertificateData(),
        note: 'Demo mode: Using sample certificate data. Real PDF processing would be implemented in production.'
      })
    };

  } catch (error) {
    console.error('Certificate processing error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Certificate processing failed'
      })
    };
  }
};

// Mock certificate data for demo purposes

function getMockCertificateData() {
  return {
    certificate_info: {
      certificate_number: 'DEMO-CERT-2024-001',
      organization: 'Demo Testing Laboratory',
      valid_until: '2025-12-31',
      accreditation_body: 'Demo Accreditation Body',
      revision_date: '2024-01-01'
    },
    test_standards: [
      {
        standard_number: 'EN 300 328',
        version: 'V2.2.2',
        category: 'Radio Frequency',
        description: 'Wideband transmission systems'
      },
      {
        standard_number: 'EN 301 489-1',
        version: 'V2.2.3',
        category: 'EMC',
        description: 'EMC standard for radio equipment'
      },
      {
        standard_number: 'EN 301 489-17',
        version: 'V3.3.1',
        category: 'EMC',
        description: 'EMC for broadband data transmission'
      },
      {
        standard_number: 'EN 55032',
        version: '2015',
        category: 'EMC',
        description: 'Multimedia equipment emissions'
      },
      {
        standard_number: 'EN 60950-1',
        version: '2006',
        category: 'Safety',
        description: 'IT equipment safety'
      }
    ],
    categories: {
      'Radio Frequency': ['EN 300 328'],
      'EMC': ['EN 301 489-1', 'EN 301 489-17', 'EN 55032'],
      'Safety': ['EN 60950-1']
    },
    total_standards: 5,
    extraction_date: new Date().toISOString(),
    pdf_source: 'uploaded_certificate.pdf'
  };
}