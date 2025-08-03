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

function getREDStandardsList() {
  return [
    // SAR and EMF Standards
    {
      number: 'EN 50360',
      title: 'Product standard to demonstrate compliance of wireless communication devices',
      version: '2017',
      date: '2017',
      type: 'Harmonised Standard',
      description: 'Product standard to demonstrate compliance of wireless communication devices with the basic restrictions related to human exposure to electromagnetic fields from handheld and body-mounted devices, in the frequency range 300 MHz to 6 GHz',
      full_number: 'EN 50360:2017',
      frequency_range: '300 MHz to 6 GHz'
    },
    {
      number: 'EN 50385',
      title: 'Product standard for base station equipment and fixed terminal stations for wireless telecommunication systems',
      version: '2017',
      date: '2017',
      type: 'Harmonised Standard',
      description: 'Product standard to demonstrate compliance of base station equipment and fixed terminal stations for wireless telecommunication systems intended for use by the general public with the basic restrictions or the reference levels related to human exposure to radio frequency electromagnetic fields',
      full_number: 'EN 50385:2017',
      frequency_range: '110 MHz to 40 GHz'
    },
    {
      number: 'EN 50401',
      title: 'Product standard to demonstrate compliance with basic restrictions for Body Area Network equipment',
      version: '2017',
      date: '2017',
      type: 'Harmonised Standard',
      description: 'Product standard to demonstrate compliance with basic restrictions for Body Area Network equipment operating in the frequency range 300 MHz to 6 GHz',
      full_number: 'EN 50401:2017',
      frequency_range: '300 MHz to 6 GHz'
    },
    {
      number: 'EN 50566',
      title: 'Product standard to demonstrate compliance of handheld and body mounted wireless communication devices',
      version: '2017',
      date: '2017',
      type: 'Harmonised Standard',
      description: 'Product standard to demonstrate compliance of handheld and body mounted wireless communication devices with the basic restrictions related to human exposure to electromagnetic fields in the frequency range 30 MHz to 6 GHz',
      full_number: 'EN 50566:2017',
      frequency_range: '30 MHz to 6 GHz'
    },
    
    // Land Mobile Service Standards
    {
      number: 'EN 300 065',
      title: 'Narrow-band direct-printing telegraph equipment in the HF bands',
      version: 'V2.1.2',
      date: '2014-10',
      type: 'Harmonised Standard',
      description: 'Electromagnetic compatibility and Radio spectrum Matters (ERM); Narrow-band direct-printing telegraph equipment in the HF bands; Radio equipment for analogue and/or digital communication; Harmonised Standard for access to radio spectrum',
      full_number: 'EN 300 065 V2.1.2',
      frequency_range: 'HF bands'
    },
    {
      number: 'EN 300 086',
      title: 'Land Mobile Service; Radio equipment with an internal or external RF connector',
      version: 'V2.1.2',
      date: '2014-10',
      type: 'Harmonised Standard',
      description: 'Electromagnetic compatibility and Radio spectrum Matters (ERM); Land Mobile Service; Radio equipment with an internal or external RF connector intended primarily for analogue speech; Harmonised Standard for access to radio spectrum',
      full_number: 'EN 300 086 V2.1.2',
      frequency_range: 'Land Mobile bands'
    },
    {
      number: 'EN 300 113',
      title: 'Land Mobile Service; Radio equipment intended for the transmission of data',
      version: 'V2.2.1',
      date: '2017-07',
      type: 'Harmonised Standard',
      description: 'Electromagnetic compatibility and Radio spectrum Matters (ERM); Land Mobile Service; Radio equipment intended for the transmission of data (and speech) and having an antenna connector; Harmonised Standard for access to radio spectrum',
      full_number: 'EN 300 113 V2.2.1',
      frequency_range: 'Land Mobile bands'
    },
    {
      number: 'EN 300 219',
      title: 'Land Mobile Service; Radio equipment transmitting signals to initiate a specific response',
      version: 'V2.1.1',
      date: '2012-11',
      type: 'Harmonised Standard',
      description: 'Electromagnetic compatibility and Radio spectrum Matters (ERM); Land Mobile Service; Radio equipment transmitting signals to initiate a specific response in the receiver; Harmonised Standard for access to radio spectrum',
      full_number: 'EN 300 219 V2.1.1',
      frequency_range: 'Land Mobile bands'
    },
    
    // Short Range Devices
    {
      number: 'EN 300 220-1',
      title: 'Short Range Devices (SRD); Radio equipment to be used in the 25 MHz to 1 000 MHz frequency range; Part 1: Technical characteristics and test methods',
      version: 'V3.1.1',
      date: '2012-01',
      type: 'Harmonised Standard',
      description: 'Short Range Devices (SRD); Radio equipment to be used in the 25 MHz to 1 000 MHz frequency range with power levels ranging up to 500 mW; Part 1: Technical characteristics and test methods',
      full_number: 'EN 300 220-1 V3.1.1',
      frequency_range: '25 MHz to 1000 MHz'
    },
    {
      number: 'EN 300 328',
      title: 'Wideband transmission systems; Data transmission equipment operating in the 2,4 GHz ISM band',
      version: 'V2.2.2',
      date: '2016-11',
      type: 'Harmonised Standard',
      description: 'Wideband transmission systems; Data transmission equipment operating in the 2,4 GHz ISM band and using wideband modulation techniques; Harmonised Standard for access to radio spectrum',
      full_number: 'EN 300 328 V2.2.2',
      frequency_range: '2.4 GHz ISM band'
    },
    {
      number: 'EN 301 025',
      title: 'VHF radiotelephone equipment for general communications',
      version: 'V2.3.1',
      date: '2020-05',
      type: 'Harmonised Standard',
      description: 'VHF radiotelephone equipment for general communications and Digital Selective Calling (DSC); Harmonised Standard for access to radio spectrum',
      full_number: 'EN 301 025 V2.3.1',
      frequency_range: 'VHF marine band'
    },
    {
      number: 'EN 301 489-1',
      title: 'ElectroMagnetic Compatibility (EMC) standard for radio equipment and services; Part 1: Common technical requirements',
      version: 'V2.2.3',
      date: '2019-03',
      type: 'Harmonised Standard',
      description: 'ElectroMagnetic Compatibility (EMC) standard for radio equipment and services; Part 1: Common technical requirements',
      full_number: 'EN 301 489-1 V2.2.3',
      notes: 'Common EMC requirements'
    },
    {
      number: 'EN 301 489-17',
      title: 'ElectroMagnetic Compatibility (EMC) standard for radio equipment and services; Part 17: Specific conditions for Broadband Data Transmission Systems',
      version: 'V3.3.1',
      date: '2023-03',
      type: 'Harmonised Standard',
      description: 'ElectroMagnetic Compatibility (EMC) standard for radio equipment and services; Part 17: Specific conditions for Broadband Data Transmission Systems',
      full_number: 'EN 301 489-17 V3.3.1',
      notes: 'Broadband systems EMC'
    },
    {
      number: 'EN 301 893',
      title: '5 GHz RLAN; Harmonised Standard for access to radio spectrum',
      version: 'V2.1.1',
      date: '2017-05',
      type: 'Harmonised Standard',
      description: '5 GHz RLAN; Harmonised Standard for access to radio spectrum',
      full_number: 'EN 301 893 V2.1.1',
      frequency_range: '5 GHz RLAN'
    },
    {
      number: 'EN 303 347-1',
      title: 'Meteorological Radars; Harmonised Standard for radio spectrum access; Part 1: S band meteorological radars',
      version: 'V2.1.1',
      date: '2020-12',
      type: 'Harmonised Standard',
      description: 'Meteorological Radars; Harmonised Standard for radio spectrum access; Part 1: S band meteorological radars operating in the frequency band 2 700 MHz to 2 900 MHz',
      full_number: 'EN 303 347-1 V2.1.1',
      frequency_range: '2,700 MHz to 2,900 MHz'
    },
    {
      number: 'EN 303 413',
      title: 'Satellite Earth Stations; Global Navigation Satellite System (GNSS) receivers',
      version: 'V1.2.1',
      date: '2021-03',
      type: 'Harmonised Standard',
      description: 'Satellite Earth Stations and Systems (SES); Global Navigation Satellite System (GNSS) receivers; Radio equipment operating in the 1,164 MHz to 1,300 MHz and 1,559 MHz to 1,610 MHz frequency bands; Harmonised Standard for access to radio spectrum',
      full_number: 'EN 303 413 V1.2.1',
      frequency_range: '1,164-1,300 MHz and 1,559-1,610 MHz'
    },
    {
      number: 'EN 300 220-1',
      title: 'Short Range Devices (SRD); Radio equipment to be used in the 25 MHz to 1 000 MHz frequency range; Part 1: Technical characteristics and test methods',
      version: 'V3.1.1',
      date: '2012-01',
      type: 'Harmonised Standard',
      description: 'Short Range Devices (SRD); Radio equipment to be used in the 25 MHz to 1 000 MHz frequency range with power levels ranging up to 500 mW; Part 1: Technical characteristics and test methods',
      full_number: 'EN 300 220-1 V3.1.1',
      frequency_range: '25 MHz to 1000 MHz'
    },
    {
      number: 'EN 300 220-2',
      title: 'Short Range Devices (SRD); Radio equipment to be used in the 25 MHz to 1 000 MHz frequency range; Part 2: Harmonised Standard for access to radio spectrum',
      version: 'V3.2.1',
      date: '2017-11',
      type: 'Harmonised Standard',
      description: 'Short Range Devices (SRD); Radio equipment to be used in the 25 MHz to 1 000 MHz frequency range with power levels ranging up to 500 mW; Part 2: Harmonised Standard for access to radio spectrum',
      full_number: 'EN 300 220-2 V3.2.1',
      frequency_range: '25 MHz to 1000 MHz'
    },
    {
      number: 'EN 300 440',
      title: 'Electromagnetic compatibility and Radio spectrum Matters (ERM); Short Range Devices; Radio equipment to be used in the 1 GHz to 40 GHz frequency range',
      version: 'V2.2.1',
      date: '2018-07',
      type: 'Harmonised Standard',
      description: 'Electromagnetic compatibility and Radio spectrum Matters (ERM); Short Range Devices; Radio equipment to be used in the 1 GHz to 40 GHz frequency range; Harmonised Standard for access to radio spectrum',
      full_number: 'EN 300 440 V2.2.1',
      frequency_range: '1 GHz to 40 GHz'
    },
    {
      number: 'EN 303 204',
      title: 'Radio frequency identification equipment operating in the band 865 MHz to 868 MHz',
      version: 'V2.1.1',
      date: '2017-10',
      type: 'Harmonised Standard',
      description: 'Radio frequency identification equipment operating in the band 865 MHz to 868 MHz with power levels up to 2 W and in the band 915 MHz to 921 MHz with power levels up to 4 W; Harmonised Standard for access to radio spectrum',
      full_number: 'EN 303 204 V2.1.1',
      frequency_range: '865-868 MHz, 915-921 MHz'
    },
    {
      number: 'EN 303 446-1',
      title: 'Professional Mobile Radio (PMR) equipment; Part 1: DMR equipment operating in the frequency bands 446,1 MHz to 446,2 MHz',
      version: 'V1.2.1',
      date: '2018-08',
      type: 'Harmonised Standard',
      description: 'Professional Mobile Radio (PMR) equipment; Part 1: DMR equipment operating in the frequency bands 446,1 MHz to 446,2 MHz; Harmonised Standard for access to radio spectrum',
      full_number: 'EN 303 446-1 V1.2.1',
      frequency_range: '446.1-446.2 MHz'
    },
    {
      number: 'EN 303 417',
      title: 'Satellite Earth Stations and Systems (SES); Harmonised Standard for satellite mobile Aircraft Earth Stations (AESs)',
      version: 'V1.2.1',
      date: '2021-01',
      type: 'Harmonised Standard',
      description: 'Satellite Earth Stations and Systems (SES); Harmonised Standard for satellite mobile Aircraft Earth Stations (AESs) operating in the 11/12/14 GHz frequency bands covering essential requirements under article 3.2 of Directive 2014/53/EU',
      full_number: 'EN 303 417 V1.2.1',
      frequency_range: '11/12/14 GHz'
    },
    {
      number: 'EN 300 086',
      title: 'Electromagnetic compatibility and Radio spectrum Matters (ERM); Land Mobile Service',
      version: 'V2.1.2',
      date: '2014-10',
      type: 'Harmonised Standard',
      description: 'Electromagnetic compatibility and Radio spectrum Matters (ERM); Land Mobile Service; Radio equipment with an internal or external RF connector intended primarily for analogue speech; Harmonised Standard for access to radio spectrum',
      full_number: 'EN 300 086 V2.1.2',
      frequency_range: 'Land Mobile bands'
    }
  ];
}

function getEMCStandardsList() {
  return [
    {
      number: 'EN ISO 13766-1',
      title: 'Earth-moving & building construction machinery — EMC',
      version: '2018',
      date: '2018',
      type: 'Harmonised Standard',
      description: 'Earth-moving & building construction machinery — EMC',
      full_number: 'EN ISO 13766-1',
      notes: '初版掲載'
    },
    {
      number: 'EN 55035',
      title: 'Multimedia equipment — Immunity requirements',
      version: '2017 (+A11:2020)',
      date: '2017',
      type: 'Harmonised Standard',
      description: 'Multimedia equipment — Immunity requirements',
      full_number: 'EN 55035 (+A11)',
      notes: 'A11 追加により置換'
    },
    {
      number: 'EN 61000-6-5',
      title: 'Generic immunity, power-station & substation',
      version: '2015 (+AC:2018-01)',
      date: '2015',
      type: 'Harmonised Standard',
      description: 'Generic immunity, power-station & substation',
      full_number: 'EN 61000-6-5 (+AC)',
      notes: ''
    },
    {
      number: 'EN IEC 61058-1',
      title: 'Switches for appliances – General requirements',
      version: '2018',
      date: '2018',
      type: 'Harmonised Standard',
      description: 'Switches for appliances – General requirements',
      full_number: 'EN IEC 61058-1',
      notes: ''
    },
    {
      number: 'EN 63024',
      title: 'Automatic reclosing devices (ARDs)',
      version: '2018',
      date: '2018',
      type: 'Harmonised Standard',
      description: 'Automatic reclosing devices (ARDs)',
      full_number: 'EN 63024',
      notes: ''
    },
    {
      number: 'EN IEC 60947-4-1',
      title: 'Contactors & motor-starters',
      version: '2019',
      date: '2019',
      type: 'Harmonised Standard',
      description: 'Contactors & motor-starters',
      full_number: 'EN IEC 60947-4-1',
      notes: '2020/660 で追加'
    },
    {
      number: 'EN IEC 60947-9-1',
      title: 'Arc-quenching devices',
      version: '2019',
      date: '2019',
      type: 'Harmonised Standard',
      description: 'Arc-quenching devices',
      full_number: 'EN IEC 60947-9-1',
      notes: ''
    },
    {
      number: 'EN 61439-3',
      title: 'Distribution boards for ordinary persons',
      version: '2012 (+AC:2019-04)',
      date: '2012',
      type: 'Harmonised Standard',
      description: 'Distribution boards for ordinary persons',
      full_number: 'EN 61439-3 (+AC)',
      notes: ''
    },
    {
      number: 'EN 12895',
      title: 'Industrial trucks — EMC',
      version: '2015 +A1:2019',
      date: '2015',
      type: 'Harmonised Standard',
      description: 'Industrial trucks — EMC',
      full_number: 'EN 12895 +A1',
      notes: ''
    },
    {
      number: 'EN 55011',
      title: 'ISM equipment — RF disturbance',
      version: '2016 (+A1:2017, A11:2020)',
      date: '2016',
      type: 'Harmonised Standard',
      description: 'ISM equipment — RF disturbance',
      full_number: 'EN 55011 (+A1,+A11)',
      notes: ''
    },
    {
      number: 'EN 55014-1',
      title: 'Household appliances — Emission',
      version: '2017 (+A11:2020)',
      date: '2017',
      type: 'Harmonised Standard',
      description: 'Household appliances — Emission',
      full_number: 'EN 55014-1 (+A11)',
      notes: ''
    },
    {
      number: 'EN IEC 55015',
      title: 'Lighting equipment — Disturbances',
      version: '2019 (+A11:2020)',
      date: '2019',
      type: 'Harmonised Standard',
      description: 'Lighting equipment — Disturbances',
      full_number: 'EN IEC 55015 (+A11)',
      notes: ''
    },
    {
      number: 'EN 55032',
      title: 'Multimedia equipment — Emission',
      version: '2015 (+A11:2020)',
      date: '2015',
      type: 'Harmonised Standard',
      description: 'Multimedia equipment — Emission',
      full_number: 'EN 55032 (+A11)',
      notes: ''
    },
    {
      number: 'EN 62026-2',
      title: 'AS-Interface devices',
      version: '2013 (+A1:2019)',
      date: '2013',
      type: 'Harmonised Standard',
      description: 'AS-Interface devices',
      full_number: 'EN 62026-2 (+A1)',
      notes: ''
    },
    {
      number: 'EN IEC 60947-5-2',
      title: 'Control-circuit devices, proximity sensors',
      version: '2020',
      date: '2020',
      type: 'Harmonised Standard',
      description: 'Control-circuit devices, proximity sensors',
      full_number: 'EN IEC 60947-5-2',
      notes: '2021/455 で追加'
    },
    {
      number: 'EN 50470-1',
      title: 'Electricity metering equipment — Part 1',
      version: '2018',
      date: '2018',
      type: 'Harmonised Standard',
      description: 'Electricity metering equipment — Part 1',
      full_number: 'EN 50470-1',
      notes: '2022/622 で追加'
    },
    {
      number: 'EN 50470-3',
      title: 'Electricity metering equipment — Part 3',
      version: '2019',
      date: '2019',
      type: 'Harmonised Standard',
      description: 'Electricity metering equipment — Part 3',
      full_number: 'EN 50470-3',
      notes: ''
    },
    {
      number: 'EN IEC 61008-1',
      title: 'RCCBs for household use',
      version: '2012 (+AC:2019-04)',
      date: '2012',
      type: 'Harmonised Standard',
      description: 'RCCBs for household use',
      full_number: 'EN IEC 61008-1 (+AC)',
      notes: ''
    },
    {
      number: 'EN IEC 60947-3',
      title: 'Switches, disconnectors & fuse-combination units',
      version: '2021',
      date: '2021',
      type: 'Harmonised Standard',
      description: 'Switches, disconnectors & fuse-combination units',
      full_number: 'EN IEC 60947-3',
      notes: '2022/910 で追加'
    }
  ];
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