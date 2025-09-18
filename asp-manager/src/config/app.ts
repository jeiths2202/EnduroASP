/**
 * Application Configuration
 * All application settings should be defined here
 */

export const APP_CONFIG = {
  api: {
    port: process.env.REACT_APP_FILE_API_PORT || 3008,
    baseUrl: process.env.REACT_APP_API_BASE_URL || 'http://localhost:3008',
    corsOrigins: process.env.REACT_APP_CORS_ORIGINS?.split(',') || ['http://localhost:3007', 'http://localhost:3000']
  },
  server: {
    port: process.env.REACT_APP_PORT || 3007,
    proxy: process.env.REACT_APP_PROXY || 'http://localhost:3008'
  },
  paths: {
    manualsBaseDir: process.env.REACT_APP_MANUALS_BASE_DIR || '/data/asp-manuals',
    outputDir: process.env.REACT_APP_OUTPUT_DIR || '/data'
  },
  ui: {
    sidebarWidth: parseInt(process.env.REACT_APP_SIDEBAR_WIDTH || '256'),
    checkInterval: parseInt(process.env.REACT_APP_CHECK_INTERVAL || '100')
  },
  search: {
    maxResults: parseInt(process.env.REACT_APP_MAX_SEARCH_RESULTS || '10'),
    minRelevanceThreshold: parseFloat(process.env.REACT_APP_MIN_RELEVANCE_THRESHOLD || '0.1'),
    maxQueryStats: parseInt(process.env.REACT_APP_MAX_QUERY_STATS || '100')
  },
  language: {
    default: process.env.REACT_APP_DEFAULT_LANGUAGE || 'ja',
    supported: process.env.REACT_APP_SUPPORTED_LANGUAGES?.split(',') || ['ja', 'ko', 'en']
  }
};