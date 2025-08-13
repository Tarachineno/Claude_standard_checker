// MD file viewer for certificate scopes
const fs = require('fs');
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

  if (event.httpMethod !== 'GET') {
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
    const { cert_type, anchor } = event.queryStringParameters || {};

    if (!cert_type) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing cert_type parameter'
        })
      };
    }

    console.log(`MD Viewer request: cert_type=${cert_type}, anchor=${anchor}`);

    // Load MD content using same logic as scope-search
    const mdContent = await loadMDContent(cert_type);
    
    if (!mdContent) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: `MD file not found: ${cert_type}-scopes.md`
        })
      };
    }

    // Parse MD content for viewer
    const parsedContent = parseMDForViewer(mdContent, cert_type, anchor);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          cert_type: cert_type,
          anchor: anchor,
          content: parsedContent
        }
      })
    };

  } catch (error) {
    console.error('MD viewer error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: `MD viewer failed: ${error.message}`
      })
    };
  }
};

// Load MD content using same logic as scope-search
async function loadMDContent(certType) {
  try {
    // Try file system first (for local development)
    const possiblePaths = [
      path.join(__dirname, '../../static/data', `${certType}-scopes.md`),
      path.join(process.cwd(), 'static/data', `${certType}-scopes.md`),
      path.join(process.cwd(), 'static', 'data', `${certType}-scopes.md`),
      `/var/task/static/data/${certType}-scopes.md`,
      `./static/data/${certType}-scopes.md`
    ];

    let mdFilePath = null;
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        mdFilePath = testPath;
        console.log(`Found MD file at: ${mdFilePath}`);
        break;
      }
    }

    let mdContent = '';
    
    if (mdFilePath) {
      // File system access (local development)
      mdContent = fs.readFileSync(mdFilePath, 'utf-8');
      console.log(`Loaded from file system: ${mdFilePath}`);
    } else {
      // HTTP fallback for Netlify production
      console.log(`File system failed, trying HTTP fallback for ${certType}-scopes.md`);
      
      const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://eu-harmonized-standards.netlify.app';
      const mdUrl = `${baseUrl}/data/${certType}-scopes.md`;
      
      console.log(`Fetching MD file from: ${mdUrl}`);
      
      const https = require('https');
      const http = require('http');
      
      mdContent = await new Promise((resolve, reject) => {
        const client = mdUrl.startsWith('https:') ? https : http;
        const request = client.get(mdUrl, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode} for ${mdUrl}`));
            return;
          }
          
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => resolve(data));
        });
        
        request.on('error', reject);
        request.setTimeout(10000, () => {
          request.destroy();
          reject(new Error('HTTP request timeout'));
        });
      });
      
      console.log(`Successfully loaded MD content via HTTP (${mdContent.length} chars)`);
    }

    return mdContent;

  } catch (error) {
    console.error(`Error loading MD content for ${certType}:`, error);
    return null;
  }
}

// Parse MD content for viewer display
function parseMDForViewer(mdContent, certType, targetAnchor) {
  const lines = mdContent.split('\n');
  const sections = [];
  let currentSection = null;
  let inTargetSection = false;
  
  // Parse certificate metadata
  const metadata = {};
  let inMetadata = true;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;
    
    // Parse metadata at the top
    if (inMetadata && line.startsWith('**') && line.includes(':**')) {
      const metaMatch = line.match(/\*\*([^*]+):\*\*\s*(.+)/);
      if (metaMatch) {
        metadata[metaMatch[1]] = metaMatch[2];
        continue;
      }
    }
    
    // Stop metadata parsing when we hit main content
    if (line.startsWith('##')) {
      inMetadata = false;
    }
    
    // Parse section headers
    if (line.startsWith('###') && line.includes('{#')) {
      // Save previous section
      if (currentSection) {
        sections.push(currentSection);
      }
      
      const match = line.match(/### (.+) \{#([^}]+)\}/);
      if (match) {
        const sectionTitle = match[1];
        const anchor = `#${match[2]}`;
        
        currentSection = {
          title: sectionTitle,
          anchor: anchor,
          content: [],
          isTarget: targetAnchor && anchor === targetAnchor
        };
        
        if (currentSection.isTarget) {
          inTargetSection = true;
        }
      }
      continue;
    }
    
    // Parse facility headers for JAB
    if (certType === 'jab' && line.includes('【施設') && line.includes('】')) {
      if (currentSection) {
        sections.push(currentSection);
      }
      
      const facilityMatch = line.match(/【施設(\d+)】(.+)（(.+)）/);
      if (facilityMatch) {
        currentSection = {
          title: `施設${facilityMatch[1]}: ${facilityMatch[2].trim()}`,
          location: facilityMatch[3],
          anchor: `#facility-${facilityMatch[1]}`,
          content: [],
          isFacility: true,
          isTarget: targetAnchor && `#facility-${facilityMatch[1]}` === targetAnchor
        };
        
        if (currentSection.isTarget) {
          inTargetSection = true;
        }
      }
      continue;
    }
    
    // Parse standard entries
    if (line.startsWith('- **') && line.includes('**')) {
      const match = line.match(/- \*\*([^*]+)\*\*\s*-?\s*(.*)/);
      if (match && currentSection) {
        const standard = match[1].trim();
        const description = match[2].trim();
        
        currentSection.content.push({
          type: 'standard',
          standard: standard,
          description: description
        });
      }
      continue;
    }
    
    // Add other content lines
    if (currentSection && line) {
      currentSection.content.push({
        type: 'text',
        content: line
      });
    }
  }
  
  // Add last section
  if (currentSection) {
    sections.push(currentSection);
  }
  
  return {
    metadata: metadata,
    sections: sections,
    targetSection: sections.find(s => s.isTarget),
    fullContent: mdContent
  };
}