// EU Harmonized Standards Checker - Netlify Function
const axios = require('axios');
const cheerio = require('cheerio');

// Directive configuration with EC webpage URLs for dynamic OJ link discovery
const DIRECTIVE_CONFIG = {
  RED: {
    name: 'Radio Equipment Directive',
    ec_webpage: 'https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/radio-equipment_en',
    fallback_urls: [
      'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=uriserv%3AOJ.L_.2022.289.01.0007.01.ENG&toc=OJ%3AL%3A2022%3A289%3ATOC',
      'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ:L_202302392',
      'https://eur-lex.europa.eu/eli/dec_impl/2023/2669/oj',
      'https://eur-lex.europa.eu/eli/dec_impl/2025/138/oj',
      'https://eur-lex.europa.eu/eli/dec_impl/2025/893/oj/eng'
    ]
  },
  EMC: {
    name: 'Electromagnetic Compatibility Directive',
    ec_webpage: 'https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/electromagnetic-compatibility-emc_en',
    fallback_urls: [
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
    ec_webpage: 'https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/low-voltage-lvd_en',
    fallback_urls: [
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

  // First, try to get dynamic OJ links from EC webpage
  let urls = [];
  try {
    console.log(`Fetching dynamic OJ links from EC webpage: ${config.ec_webpage}`);
    urls = await getOJLinksFromECPage(config.ec_webpage);
    console.log(`Found ${urls.length} OJ links from EC webpage`);
    
    if (urls.length === 0) {
      console.log('No OJ links found on EC webpage, using fallback URLs');
      urls = config.fallback_urls;
    }
  } catch (error) {
    console.error('Error fetching from EC webpage, using fallback URLs:', error.message);
    urls = config.fallback_urls;
  }

  for (const url of urls) {
    try {
      console.log(`Fetching from: ${url}`);
      
      const response = await axios.get(url, {
        timeout: 15000,
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

// Function to extract OJ links from EC webpage
async function getOJLinksFromECPage(ecUrl) {
  try {
    const response = await axios.get(ecUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const ojLinks = [];

    // Look for links to eur-lex.europa.eu in the "Publications in the Official Journal" section
    $('a[href*="eur-lex.europa.eu"]').each((i, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().trim();
      
      // Filter for OJ links (Commission Implementing Decision or Amendment)
      if (href && (text.includes('Commission Implementing Decision') || 
                   text.includes('Amendment') || 
                   text.includes('OJ L') ||
                   text.includes('Official Journal'))) {
        
        let fullUrl = href;
        if (href.startsWith('/')) {
          fullUrl = 'https://eur-lex.europa.eu' + href;
        }
        
        if (!ojLinks.includes(fullUrl)) {
          ojLinks.push(fullUrl);
          console.log(`Found OJ link: ${fullUrl}`);
        }
      }
    });

    // Also look for links in paragraphs that mention OJ or Official Journal
    $('p, div, section').each((i, element) => {
      const text = $(element).text();
      if (text.includes('Official Journal') || text.includes('OJ L') || text.includes('Commission Implementing Decision')) {
        $(element).find('a[href*="eur-lex.europa.eu"]').each((j, link) => {
          const href = $(link).attr('href');
          if (href) {
            let fullUrl = href;
            if (href.startsWith('/')) {
              fullUrl = 'https://eur-lex.europa.eu' + href;
            }
            
            if (!ojLinks.includes(fullUrl)) {
              ojLinks.push(fullUrl);
              console.log(`Found OJ link in text: ${fullUrl}`);
            }
          }
        });
      }
    });

    return ojLinks;
    
  } catch (error) {
    console.error('Error fetching OJ links from EC page:', error.message);
    return [];
  }
}

function parseStandardsFromHtml($, directive) {
  const standards = [];
  
  // Enhanced patterns for better standard detection
  const patterns = [
    'td:contains("EN ")',
    'td:contains("IEC ")', 
    'td:contains("ISO ")',
    'p:contains("EN ")',
    'div:contains("EN ")',
    'tr:has(td:contains("EN "))',  // Table rows containing EN standards
    'li:contains("EN ")'            // List items containing EN standards
  ];

  patterns.forEach(pattern => {
    $(pattern).each((i, element) => {
      const text = $(element).text().trim();
      const standardMatches = extractStandardsFromText(text);
      
      standardMatches.forEach(match => {
        // Enhanced standard object with better formatting
        standards.push({
          number: match.number,
          title: match.title || '',
          version: match.version || '',
          date: match.date || null,
          type: 'Harmonised Standard',
          description: match.description || match.title || '',
          full_number: match.full_number || match.number
        });
      });
    });
  });

  return standards;
}

function extractStandardsFromText(text) {
  const standards = [];
  
  // Enhanced regex patterns for comprehensive standard detection
  const patterns = [
    // EN 301 489-17 V3.2.1 format
    /EN\s+(\d+(?:\s+\d+)*(?:-\d+)*(?:-\d+)*)\s+V(\d+\.\d+\.\d+)\s*([^;]*?)(?:;|$|\.)/gi,
    // EN 301 489-17 V3.2.1 (year) format  
    /EN\s+(\d+(?:\s+\d+)*(?:-\d+)*(?:-\d+)*)\s+V(\d+\.\d+\.\d+)\s*\((\d{4})\)\s*([^;]*?)(?:;|$|\.)/gi,
    // EN 301 489-17 (2017) format
    /EN\s+(\d+(?:\s+\d+)*(?:-\d+)*(?:-\d+)*)\s*\((\d{4})\)\s*([^;]*?)(?:;|$|\.)/gi,
    // EN 301 489-17 format without version
    /EN\s+(\d+(?:\s+\d+)*(?:-\d+)*(?:-\d+)*)\s*([^;]*?)(?:;|$|\.)/gi,
    // EN IEC format
    /EN\s+IEC\s+(\d+(?:-\d+)*)\s*(?:V(\d+\.\d+\.\d+))?\s*([^;]*?)(?:;|$|\.)/gi,
    // EN ISO format
    /EN\s+ISO\s+(\d+(?:-\d+)*)\s*(?:V(\d+\.\d+\.\d+))?\s*([^;]*?)(?:;|$|\.)/gi
  ];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let number, version, year, title, description;
      
      if (pattern.source.includes('IEC')) {
        number = `EN IEC ${match[1].replace(/\s+/g, ' ')}`;
        version = match[2] ? `V${match[2]}` : '';
        title = match[3] ? match[3].trim() : '';
      } else if (pattern.source.includes('ISO')) {
        number = `EN ISO ${match[1].replace(/\s+/g, ' ')}`;
        version = match[2] ? `V${match[2]}` : '';
        title = match[3] ? match[3].trim() : '';
      } else {
        // Regular EN format
        const baseNumber = match[1].replace(/\s+/g, ' ');
        number = `EN ${baseNumber}`;
        
        if (match.length === 5) { // V3.2.1 (year) format
          version = `V${match[2]}`;
          year = match[3];
          title = match[4] ? match[4].trim() : '';
        } else if (match.length === 4 && match[2] && match[2].includes('.')) { // V3.2.1 format
          version = `V${match[2]}`;
          title = match[3] ? match[3].trim() : '';
        } else if (match.length === 4 && match[2] && match[2].length === 4) { // (year) format
          year = match[2];
          title = match[3] ? match[3].trim() : '';
          version = `(${year})`;
        } else {
          title = match[2] ? match[2].trim() : '';
          version = '';
        }
      }
      
      // Create full number with version
      const fullNumber = version ? `${number} ${version}` : number;
      
      // Clean up title/description
      description = title
        .replace(/^\s*[-–—]\s*/, '') // Remove leading dashes
        .replace(/\s+/g, ' ')        // Normalize spaces
        .trim();

      if (number.length > 3) { // Basic validation
        standards.push({
          number: number,
          full_number: fullNumber,
          title: title,
          description: description,
          version: version,
          year: year,
          date: year || null
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