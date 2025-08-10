// EU Harmonized Standards Checker - Netlify Function
const axios = require('axios');
const cheerio = require('cheerio');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Load directive configuration from external JSON file
const directivesData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../static/api/directives.json'), 'utf-8')
).data;

function getDirectiveConfig(code) {
  return directivesData.find(d => d.code === code);
}

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
    const config = getDirectiveConfig(directive);

    if (!directive || !config) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid directive code. Use EMC, RED, or LVD.'
        })
      };
    }

    console.log(`Fetching standards for ${directive} directive`);

    // Fetch standards from EUR-Lex pages
    const result = await fetchStandardsFromEurlex(directive, config);
    const standards = result.standards;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          directive: directive,
          directive_name: config.name,
          standards: standards,
          count: standards.length,
          update_available: result.updateAvailable,
          added_standards: result.added || []
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

async function fetchStandardsFromEurlex(directive, config) {
  // For EMC, RED, and LVD, fetch from the official Excel files
  if (['EMC', 'RED', 'LVD'].includes(directive)) {
    return await fetchStandardsFromExcel(directive, config);
  }
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
  return { standards: allStandards, updateAvailable: false, added: [] };
}

// Function to fetch standards from official Excel files
async function fetchStandardsFromExcel(directive, config) {
  const excelUrl = config.excel_url;
  const dataDir = path.join(__dirname, '../../static/data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const filePath = path.join(dataDir, `${directive}.xlsx`);
  const metaPath = path.join(dataDir, `${directive}-meta.json`);

  let remoteLastMod = null;
  try {
    const headResp = await axios.head(excelUrl, { timeout: 10000 });
    remoteLastMod = headResp.headers['last-modified'] || null;
  } catch (err) {
    console.warn('HEAD request failed:', err.message);
  }

  let meta = null;
  if (fs.existsSync(metaPath)) {
    try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')); } catch (_) { meta = null; }
  }

  let updateAvailable = false;
  if (remoteLastMod && meta?.lastModified && remoteLastMod !== meta.lastModified) {
    updateAvailable = true;
  }

  let oldStandards = [];
  if (updateAvailable && fs.existsSync(filePath)) {
    try {
      const oldWorkbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });
      const oldSheet = oldWorkbook.SheetNames[0];
      const oldJson = XLSX.utils.sheet_to_json(oldWorkbook.Sheets[oldSheet], { header: 1 });
      oldStandards = parseStandardsFromExcelData(oldJson, directive).map(s => s.number);
    } catch (e) {
      console.warn('Failed to parse old Excel for diff:', e.message);
    }
  }

  let excelBuffer = null;
  if (!updateAvailable && fs.existsSync(filePath)) {
    excelBuffer = fs.readFileSync(filePath);
    console.log(`Using cached Excel file for ${directive}`);
  } else {
    console.log(`Downloading Excel file for ${directive}:`, excelUrl);
    const response = await axios.get(excelUrl, {
      timeout: 30000,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    excelBuffer = response.data;
    fs.writeFileSync(filePath, excelBuffer);
    fs.writeFileSync(metaPath, JSON.stringify({ lastModified: remoteLastMod || new Date().toISOString() }, null, 2));
    updateAvailable = remoteLastMod && meta?.lastModified && remoteLastMod !== meta.lastModified;
  }

  console.log('Excel file loaded, parsing...');

  try {
    // Parse Excel file
    const workbook = XLSX.read(excelBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log(`Excel file parsed, found ${jsonData.length} rows`);
    
    // Parse standards from Excel data
    const standards = parseStandardsFromExcelData(jsonData, directive);
    const newNumbers = standards.map(s => s.number);
    let added = [];
    if (updateAvailable) {
      const oldSet = new Set(oldStandards);
      added = newNumbers.filter(n => !oldSet.has(n));
    }

    console.log(`Parsed ${standards.length} standards from Excel file`);

    return { standards, updateAvailable, added };

  } catch (error) {
    console.error(`Error fetching ${directive} standards from Excel:`, error.message);
    throw error;
  }
}

// Function to parse standards from Excel data
function parseStandardsFromExcelData(excelData, directive) {
  const standards = [];
  
  // Skip header rows and process data
  for (let i = 1; i < excelData.length; i++) {
    const row = excelData[i];
    
    if (!row || row.length < 2) continue;
    
    // Different Excel formats for different directives
    let standardNumber, title, versionOrDate, notes;
    
    if (directive === 'EMC') {
      // EMC Excel format: [Legislation, ESO, Standard Number, Title, Date, OJ, ...]
      standardNumber = row[2] ? String(row[2]).trim() : '';
      title = row[3] ? String(row[3]).trim() : '';
      versionOrDate = row[4] ? String(row[4]).trim() : '';
      notes = row[5] ? String(row[5]).trim() : '';
    } else if (directive === 'RED') {
      // RED Excel format - similar structure expected
      standardNumber = row[2] ? String(row[2]).trim() : '';
      title = row[3] ? String(row[3]).trim() : '';
      versionOrDate = row[4] ? String(row[4]).trim() : '';
      notes = row[5] ? String(row[5]).trim() : '';
    } else if (directive === 'LVD') {
      // LVD Excel format - similar structure expected
      standardNumber = row[2] ? String(row[2]).trim() : '';
      title = row[3] ? String(row[3]).trim() : '';
      versionOrDate = row[4] ? String(row[4]).trim() : '';
      notes = row[5] ? String(row[5]).trim() : '';
    }
    
    // Skip if no standard number or doesn't contain EN
    if (!standardNumber || !standardNumber.includes('EN')) continue;
    
    // Clean up standard number
    let cleanNumber = standardNumber;
    let version = '';
    let date = '';
    
    // Extract version and date information
    if (versionOrDate) {
      // Handle Excel serial date numbers (e.g., 43056, 45809)
      if (versionOrDate.match(/^\d{4,5}$/)) {
        const excelSerialDate = parseInt(versionOrDate);
        if (excelSerialDate > 40000 && excelSerialDate < 50000) {
          // Convert Excel serial date to actual date
          // Excel serial date: 1900-01-01 is day 1, but Excel incorrectly treats 1900 as leap year
          // So we use 1899-12-30 as base and add the serial number of days
          const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
          const actualDate = new Date(excelEpoch.getTime() + excelSerialDate * 24 * 60 * 60 * 1000);
          date = actualDate.toISOString().split('T')[0]; // YYYY-MM-DD format
          version = actualDate.getFullYear().toString();
        } else {
          // Regular 4-digit year
          date = versionOrDate;
          version = versionOrDate;
        }
      } else if (versionOrDate.includes('V')) {
        version = versionOrDate;
      } else if (versionOrDate.match(/\d{4}/)) {
        date = versionOrDate.match(/\d{4}/)[0];
        version = versionOrDate;
      }
    }
    
    // Handle amendments in standard number
    if (standardNumber.includes('(+A') || standardNumber.includes('+A')) {
      const amendmentMatch = standardNumber.match(/\(\+A\d+\)|\+A\d+/);
      if (amendmentMatch) {
        cleanNumber = standardNumber.replace(amendmentMatch[0], '').trim();
        cleanNumber += ` ${amendmentMatch[0]}`;
      }
    }
    
    if (standardNumber.includes('(+AC)')) {
      cleanNumber = standardNumber.replace('(+AC)', '').trim() + ' (+AC)';
    }
    
    // Create full number
    const fullNumber = version && version.startsWith('V') ? `${cleanNumber} ${version}` : cleanNumber;
    
    standards.push({
      number: cleanNumber,
      full_number: fullNumber,
      title: title,
      description: title,
      version: version || date,
      date: date,
      type: 'Harmonised Standard',
      notes: notes,
      // Excel specific fields
      legislation_reference: directive === 'EMC' ? '2014/30/EU' : directive === 'RED' ? '2014/53/EU' : '2014/35/EU',
      eso: row[1] ? String(row[1]).trim() : '',
      oj_reference: row[5] ? String(row[5]).trim() : '',
      restriction: row[6] ? String(row[6]).trim() : '',
      withdrawal_date: convertExcelDate(row[9]),
      withdrawal_reference: row[10] ? String(row[10]).trim() : ''
    });
  }
  
  return standards;
}

// Helper function to convert Excel serial dates
function convertExcelDate(dateValue) {
  if (!dateValue) return '';
  
  const dateStr = String(dateValue).trim();
  if (!dateStr || dateStr === '-') return '';
  
  // Check if it's an Excel serial date number
  if (dateStr.match(/^\d{4,5}$/)) {
    const excelSerialDate = parseInt(dateStr);
    if (excelSerialDate > 40000 && excelSerialDate < 50000) {
      // Convert Excel serial date to actual date
      const excelEpoch = new Date(1899, 11, 30);
      const actualDate = new Date(excelEpoch.getTime() + excelSerialDate * 24 * 60 * 60 * 1000);
      return actualDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    }
  }
  
  return dateStr;
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
  try {
    // Load fallback standards from external JSON file
    const fallbackPath = path.join(__dirname, '../../static/data/fallback-standards.json');
    const fallbackStandards = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
    
    return fallbackStandards[directive] || {
      directive: directive,
      directive_name: 'Unknown Directive',
      standards: [],
      count: 0
    };
  } catch (error) {
    console.error('Error loading fallback standards:', error);
    // Ultimate fallback - return minimal data
    return {
      directive: directive,
      directive_name: 'Unknown Directive',
      standards: [],
      count: 0
    };
  }
}