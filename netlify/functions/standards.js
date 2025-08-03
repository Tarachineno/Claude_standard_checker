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
          error: 'Invalid directive code. Use RED or EMC.'
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
  let allStandards = [];
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
        timeout: 25000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Cache-Control': 'no-cache'
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

  // Remove duplicate standards (prefer detailed versions over simplified ones)
  allStandards = removeDuplicateStandards(allStandards);

  // Sort by standard number
  allStandards.sort((a, b) => a.number.localeCompare(b.number));
  
  console.log(`Total unique standards found: ${allStandards.length}`);
  return allStandards;
}

// Function to extract OJ links from EC webpage
async function getOJLinksFromECPage(ecUrl) {
  try {
    const response = await axios.get(ecUrl, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
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
  
  // Enhanced patterns for better standard detection - focus on table structures
  const patterns = [
    'table td:contains("EN ")',
    'table td:contains("IEC ")', 
    'table td:contains("ISO ")',
    'tbody tr',  // Table rows that might contain standards
    'table tr',  // All table rows
    'div.table-responsive table td',  // Responsive table cells
    'div[class*="table"] td',  // Tables in divs
    'p:contains("EN ")',
    'div:contains("EN ")',
    'li:contains("EN ")'
  ];

  // Also look for ANNEX sections specifically
  $('div:contains("ANNEX"), section:contains("ANNEX"), h1:contains("ANNEX"), h2:contains("ANNEX"), h3:contains("ANNEX")').each((i, element) => {
    const annexSection = $(element).parent();
    annexSection.find('table tr, p, div').each((j, row) => {
      const text = $(row).text().trim();
      if (text.includes('EN ') || text.includes('EN\t') || text.includes('EN\n')) {
        const standardMatches = extractStandardsFromText(text);
        standardMatches.forEach(match => {
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
      }
    });
  });

  patterns.forEach(pattern => {
    $(pattern).each((i, element) => {
      const text = $(element).text().trim();
      if (text.includes('EN ') || text.includes('EN\t') || text.includes('EN:')) {
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
      }
    });
  });

  return standards;
}

function extractStandardsFromText(text) {
  const standards = [];
  
  // Enhanced regex patterns for better standard detection in OJ documents
  const patterns = [
    // Standard EN patterns with various version formats
    /EN\s+(\d+(?:\s*-\s*\d+)*(?:\s*-\s*\d+)*)\s*:?\s*(\d{4})\s*([^;\n\r\t]*?)(?:;|\n|\r|\t|$)/gi,
    /EN\s+(\d+(?:\s*-\s*\d+)*(?:\s*-\s*\d+)*)\s+V(\d+\.\d+\.\d+)\s*([^;\n\r\t]*?)(?:;|\n|\r|\t|$)/gi,
    /EN\s+(\d+(?:\s*-\s*\d+)*(?:\s*-\s*\d+)*)\s+V(\d+\.\d+)\s*([^;\n\r\t]*?)(?:;|\n|\r|\t|$)/gi,
    /EN\s+(\d+(?:\s*-\s*\d+)*(?:\s*-\s*\d+)*)\s*([^;\n\r\t\d]*?)(?:;|\n|\r|\t|$)/gi,
    
    // EN IEC patterns
    /EN\s+IEC\s+(\d+(?:\s*-\s*\d+)*)\s*:?\s*(\d{4})\s*([^;\n\r\t]*?)(?:;|\n|\r|\t|$)/gi,
    /EN\s+IEC\s+(\d+(?:\s*-\s*\d+)*)\s+V(\d+\.\d+\.\d+)\s*([^;\n\r\t]*?)(?:;|\n|\r|\t|$)/gi,
    /EN\s+IEC\s+(\d+(?:\s*-\s*\d+)*)\s*([^;\n\r\t\d]*?)(?:;|\n|\r|\t|$)/gi,
    
    // EN ISO patterns  
    /EN\s+ISO\s+(\d+(?:\s*-\s*\d+)*)\s*:?\s*(\d{4})\s*([^;\n\r\t]*?)(?:;|\n|\r|\t|$)/gi,
    /EN\s+ISO\s+(\d+(?:\s*-\s*\d+)*)\s+V(\d+\.\d+\.\d+)\s*([^;\n\r\t]*?)(?:;|\n|\r|\t|$)/gi,
    /EN\s+ISO\s+(\d+(?:\s*-\s*\d+)*)\s*([^;\n\r\t\d]*?)(?:;|\n|\r|\t|$)/gi,
    
    // Patterns for amendments and additions
    /EN\s+(\d+(?:\s*-\s*\d+)*)\s*\(\+A\d+\)\s*([^;\n\r\t]*?)(?:;|\n|\r|\t|$)/gi,
    /EN\s+(\d+(?:\s*-\s*\d+)*)\s*\(\+AC\)\s*([^;\n\r\t]*?)(?:;|\n|\r|\t|$)/gi,
    /EN\s+(\d+(?:\s*-\s*\d+)*)\s*\+A\d+\s*([^;\n\r\t]*?)(?:;|\n|\r|\t|$)/gi
  ];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let number = match[1] ? match[1].replace(/\s+/g, ' ').trim() : '';
      let version = '';
      let title = '';
      let date = '';
      
      // Determine prefix based on pattern
      if (pattern.source.includes('IEC')) {
        number = `EN IEC ${number}`;
      } else if (pattern.source.includes('ISO')) {
        number = `EN ISO ${number}`;
      } else {
        number = `EN ${number}`;
      }
      
      // Handle amendments in number
      if (text.includes('(+A') || text.includes('+A')) {
        const amendmentMatch = text.match(/\(\+A\d+\)|\+A\d+/);
        if (amendmentMatch) {
          number += ` ${amendmentMatch[0]}`;
        }
      }
      
      if (text.includes('(+AC)')) {
        number += ' (+AC)';
      }
      
      // Extract version and title based on match groups
      if (match[2]) {
        if (match[2].match(/^\d{4}$/)) {
          // Year format
          date = match[2];
          version = match[2];
          title = match[3] || '';
        } else if (match[2].match(/^\d+\.\d+/)) {
          // Version format
          version = `V${match[2]}`;
          title = match[3] || '';
        } else {
          // Title
          title = match[2];
        }
      }
      
      // Clean up title
      title = title.replace(/^\s*[-–—]\s*/, '').trim();
      title = title.replace(/^\s*[:\-]\s*/, '').trim();
      
      // Create full number with version
      const fullNumber = version && version.startsWith('V') ? `${number} ${version}` : number;
      
      // Extract year from title if not found elsewhere
      if (!date) {
        const yearMatch = title.match(/(\d{4})/);
        if (yearMatch) {
          date = yearMatch[1];
        }
      }

      if (number.length > 5 && number.includes('EN')) { // Basic validation
        standards.push({
          number: number,
          full_number: fullNumber,
          title: title,
          description: title,
          version: version || date,
          date: date
        });
      }
    }
  });

  return standards;
}

function removeDuplicateStandards(standards) {
  const standardMap = new Map();
  
  standards.forEach(standard => {
    const baseNumber = standard.number;
    const version = standard.version || '';
    
    if (!standardMap.has(baseNumber)) {
      standardMap.set(baseNumber, standard);
    } else {
      const existing = standardMap.get(baseNumber);
      const existingVersion = existing.version || '';
      
      // Prefer detailed versions (e.g., V2.1.2) over simplified ones (e.g., V2)
      if (isMoreDetailedVersion(version, existingVersion)) {
        standardMap.set(baseNumber, standard);
      }
    }
  });
  
  return Array.from(standardMap.values());
}

function isMoreDetailedVersion(version1, version2) {
  // Remove 'V' prefix and handle empty versions
  const v1 = (version1 || '').replace(/^V/, '');
  const v2 = (version2 || '').replace(/^V/, '');
  
  // If one is empty, prefer the non-empty one
  if (!v1 && v2) return false;
  if (v1 && !v2) return true;
  if (!v1 && !v2) return false;
  
  // Count dots to determine detail level (e.g., "2.1.2" has more dots than "2")
  const dots1 = (v1.match(/\./g) || []).length;
  const dots2 = (v2.match(/\./g) || []).length;
  
  // More dots = more detailed version
  if (dots1 > dots2) return true;
  if (dots1 < dots2) return false;
  
  // Same number of dots, prefer lexicographically larger (newer) version
  return v1 > v2;
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
    }
  };

  return fallbackStandards[directive] || {
    directive: directive,
    directive_name: 'Unknown Directive',
    standards: [],
    count: 0
  };
}