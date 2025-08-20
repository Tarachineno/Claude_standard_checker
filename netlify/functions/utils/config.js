// Shared configuration for Netlify Functions
// Centralizes environment-dependent URLs and settings

// Get the site URL from environment variables
function getSiteUrl() {
  return process.env.URL || 
         process.env.DEPLOY_PRIME_URL || 
         process.env.DEPLOY_URL || 
         'https://eu-harmonized-standards.netlify.app'; // Updated fallback URL
}

// Common API endpoints
const API_ENDPOINTS = {
  DIRECTIVES: '/api/directives.json',
  STATIC_DIRECTIVES: '/static/api/directives.json'
};

// Get possible URLs for directives.json
function getDirectivesUrls() {
  const siteUrl = getSiteUrl();
  return [
    `${siteUrl}${API_ENDPOINTS.DIRECTIVES}`,
    `${siteUrl}${API_ENDPOINTS.STATIC_DIRECTIVES}`
  ];
}

// Debug logging control
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';
const log = DEBUG ? console.log : () => {};
const logError = console.error; // Always log errors

module.exports = {
  getSiteUrl,
  getDirectivesUrls,
  API_ENDPOINTS,
  DEBUG,
  log,
  logError
};