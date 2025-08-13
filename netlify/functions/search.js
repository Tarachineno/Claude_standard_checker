// Search standards across all directives - Netlify Function
const { handler: standardsHandler } = require('./standards');

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
    const query = event.queryStringParameters?.q;
    
    if (!query || query.trim().length < 2) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Search query must be at least 2 characters long'
        })
      };
    }

    console.log(`Searching for: ${query}`);

    // Get standards from all directives
    const directives = ['RED', 'EMC', 'LVD'];
    const allResults = [];

    for (const directive of directives) {
      try {
        // Call standards function directly
        const standardsEvent = {
          httpMethod: 'GET',
          queryStringParameters: { directive: directive }
        };
        
        const standardsResponse = await standardsHandler(standardsEvent, context);
        
        if (standardsResponse.statusCode === 200) {
          const responseData = JSON.parse(standardsResponse.body);
          
          if (responseData.success) {
            const standards = responseData.data.standards;
            
            // Filter standards that match the query
            const matches = standards.filter(standard => 
              standard.number.toLowerCase().includes(query.toLowerCase()) ||
              standard.title.toLowerCase().includes(query.toLowerCase())
            );

            // Add directive info to each match
            matches.forEach(match => {
              allResults.push({
                ...match,
                directive: directive,
                directive_name: responseData.data.directive_name
              });
            });
          }
        }
      } catch (error) {
        console.error(`Error searching ${directive}:`, error.message);
        continue;
      }
    }

    // Sort results by relevance (exact matches first, then partial matches)
    allResults.sort((a, b) => {
      const aExact = a.number.toLowerCase() === query.toLowerCase();
      const bExact = b.number.toLowerCase() === query.toLowerCase();
      
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      return a.number.localeCompare(b.number);
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          query: query,
          results: allResults,
          count: allResults.length
        }
      })
    };

  } catch (error) {
    console.error('Search error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Search failed'
      })
    };
  }
};