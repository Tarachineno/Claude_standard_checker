// EU Harmonized Standards Checker - Netlify Function
const axios = require('axios');
const cheerio = require('cheerio');

// Directive configuration
const DIRECTIVE_CONFIG = {
  RED: {
    name: 'Radio Equipment Directive',
    urls: [
      'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=uriserv%3AOJ.L_.2022.289.01.0007.01.ENG&toc=OJ%3AL%3A2022%3A289%3ATOC',
      'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ:L_202302392',
      'https://eur-lex.europa.eu/eli/dec_impl/2023/2669/oj',
      'https://eur-lex.europa.eu/eli/dec_impl/2025/138/oj',
      'https://eur-lex.europa.eu/eli/dec_impl/2025/893/oj/eng'
    ]
  },
  EMC: {
    name: 'Electromagnetic Compatibility Directive',
    urls: [
      'https://eur-lex.europa.eu/legal-content/EN/TXT/?toc=OJ%3AL%3A2019%3A206%3ATOC&uri=uriserv%3AOJ.L_.2019.206.01.0027.01.ENG',
      'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=uriserv:OJ.L_.2020.155.01.0016.01.ENG&toc=OJ:L:2020:155:TOC',
      'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=uriserv:OJ.L_.2020.366.01.0017.01.ENG',
      'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=uriserv%3AOJ.L_.2021.089.01.0017.01.ENG',
      'https://eur-lex.europa.eu/eli/dec_impl/2022/622/oj',
      'https://eur-lex.europa.eu/eli/dec_impl/2022/910/oj'
    ]
  },
  LVD: {
    name: 'Low Voltage Directive',
    urls: [
      'https://eur-lex.europa.eu/eli/dec_impl/2023/2723/oj',
      'https://eur-lex.europa.eu/eli/dec_impl/2024/1198/oj',
      'https://eur-lex.europa.eu/eli/dec_impl/2024/2764/oj'
    ]
  }
};

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
    // Get directive from query parameters
    const directive = event.queryStringParameters?.directive;
    
    if (!directive || !DIRECTIVE_CONFIG[directive]) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid directive code. Use RED, EMC, or LVD.'
        })
      };
    }

    console.log(`Fetching standards for ${directive} directive`);

    // Fetch standards from EUR-Lex pages
    const standards = await fetchStandardsFromEurlex(directive);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          directive: directive,
          directive_name: DIRECTIVE_CONFIG[directive].name,
          standards: standards,
          count: standards.length
        }
      })
    };

  } catch (error) {
    console.error('Error fetching standards:', error);
    
    // Return fallback data
    const fallbackData = getFallbackData(event.queryStringParameters?.directive);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: fallbackData,
        note: 'Using cached data due to fetch error'
      })
    };
  }
};

async function fetchStandardsFromEurlex(directive) {
  const config = DIRECTIVE_CONFIG[directive];
  const allStandards = [];
  const standardsSet = new Set(); // To avoid duplicates

  for (const url of config.urls) {
    try {
      console.log(`Fetching from: ${url}`);
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      const standards = parseStandardsFromHtml($, directive);
      
      standards.forEach(standard => {
        const key = `${standard.number}-${standard.version}`;
        if (!standardsSet.has(key)) {
          standardsSet.add(key);
          allStandards.push(standard);
        }
      });

      console.log(`Found ${standards.length} standards from ${url}`);
      
    } catch (error) {
      console.error(`Error fetching from ${url}:`, error.message);
      continue;
    }
  }

  // Sort by standard number
  allStandards.sort((a, b) => a.number.localeCompare(b.number));
  
  console.log(`Total unique standards found: ${allStandards.length}`);
  return allStandards;
}

function parseStandardsFromHtml($, directive) {
  const standards = [];
  
  // Look for various patterns in the HTML that contain standard information
  const patterns = [
    'td:contains("EN ")',
    'td:contains("IEC ")', 
    'td:contains("ISO ")',
    'p:contains("EN ")',
    'div:contains("EN ")'
  ];

  patterns.forEach(pattern => {
    $(pattern).each((i, element) => {
      const text = $(element).text().trim();
      const standardMatches = extractStandardsFromText(text);
      
      standardMatches.forEach(match => {
        standards.push({
          number: match.number,
          title: match.title || '',
          version: match.version || '',
          date: match.date || null,
          type: 'Harmonised Standard'
        });
      });
    });
  });

  return standards;
}

function extractStandardsFromText(text) {
  const standards = [];
  
  // Enhanced regex patterns for different standard formats
  const patterns = [
    /EN\s+(\d+(?:\s*-\s*\d+)*(?:\s*-\s*\d+)*)\s*(?:V?(\d+\.\d+\.\d+))?\s*([^;]*?)(?:;|$)/gi,
    /EN\s+IEC\s+(\d+(?:\s*-\s*\d+)*)\s*(?:V?(\d+\.\d+\.\d+))?\s*([^;]*?)(?:;|$)/gi,
    /EN\s+ISO\s+(\d+(?:\s*-\s*\d+)*)\s*(?:V?(\d+\.\d+\.\d+))?\s*([^;]*?)(?:;|$)/gi
  ];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const number = `EN ${match[1].replace(/\s+/g, ' ')}`;
      const version = match[2] ? `V${match[2]}` : '';
      const title = match[3] ? match[3].trim() : '';
      
      // Extract date if present
      const dateMatch = text.match(/(\d{1,2}[.\s]\d{1,2}[.\s]\d{4})/);
      const date = dateMatch ? dateMatch[1] : null;

      if (number.length > 3) { // Basic validation
        standards.push({
          number: number,
          title: title,
          version: version,
          date: date
        });
      }
    }
  });

  return standards;
}

function getFallbackData(directive) {
  const fallbackStandards = {
    RED: {
      directive: 'RED',
      directive_name: 'Radio Equipment Directive',
      standards: [
        {
          number: 'EN 300 220-1',
          title: 'Short Range Devices (SRD); Radio equipment to be used in the 25 MHz to 1 000 MHz frequency range; Part 1: Technical characteristics and test methods',
          version: 'V3.1.1',
          date: '2012-01-04',
          type: 'Harmonised Standard'
        },
        {
          number: 'EN 300 328',
          title: 'Wideband transmission systems; Data transmission equipment operating in the 2,4 GHz ISM band',
          version: 'V2.2.2',
          date: '2016-11-30',
          type: 'Harmonised Standard'
        },
        {
          number: 'EN 301 489-1',
          title: 'ElectroMagnetic Compatibility (EMC) standard for radio equipment and services; Part 1: Common technical requirements',
          version: 'V2.2.3',
          date: '2019-03-12',
          type: 'Harmonised Standard'
        },
        {
          number: 'EN 301 489-17',
          title: 'ElectroMagnetic Compatibility (EMC) standard for radio equipment and services; Part 17: Specific conditions for Broadband Data Transmission Systems',
          version: 'V3.3.1',
          date: '2023-03-15',
          type: 'Harmonised Standard'
        },
        {
          number: 'EN 301 893',
          title: '5 GHz RLAN; Harmonised Standard for access to radio spectrum',
          version: 'V2.1.1',
          date: '2017-05-12',
          type: 'Harmonised Standard'
        }
      ],
      count: 5
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
        },
        {
          number: 'EN 55035',
          title: 'Electromagnetic compatibility of multimedia equipment - Immunity requirements',
          version: '2017',
          date: '2017-06-01',
          type: 'Harmonised Standard'
        },
        {
          number: 'EN 61000-3-2',
          title: 'Electromagnetic compatibility (EMC) - Part 3-2: Limits - Limits for harmonic current emissions',
          version: '2014',
          date: '2014-09-01',
          type: 'Harmonised Standard'
        },
        {
          number: 'EN 61000-4-2',
          title: 'Electromagnetic compatibility (EMC) - Part 4-2: Testing and measurement techniques - Electrostatic discharge immunity test',
          version: '2009',
          date: '2009-02-01',
          type: 'Harmonised Standard'
        }
      ],
      count: 4
    },
    LVD: {
      directive: 'LVD',
      directive_name: 'Low Voltage Directive',
      standards: [
        {
          number: 'EN 60950-1',
          title: 'Information technology equipment - Safety - Part 1: General requirements',
          version: '2006',
          date: '2006-01-01',
          type: 'Harmonised Standard'
        },
        {
          number: 'EN 62368-1',
          title: 'Audio/video, information and communication technology equipment - Part 1: Safety requirements',
          version: '2014',
          date: '2014-02-26',
          type: 'Harmonised Standard'
        },
        {
          number: 'EN 60335-1',
          title: 'Household and similar electrical appliances - Safety - Part 1: General requirements',
          version: '2012',
          date: '2012-10-01',
          type: 'Harmonised Standard'
        }
      ],
      count: 3
    }
  };

  return fallbackStandards[directive] || {
    directive: directive,
    directive_name: 'Unknown Directive',
    standards: [],
    count: 0
  };
}