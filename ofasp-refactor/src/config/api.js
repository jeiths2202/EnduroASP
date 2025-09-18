/**
 * API Configuration
 * All API endpoints and URLs should be defined here
 */

export const API_CONFIG = {
  PDF_CONVERTER: {
    BASE_URL: process.env.REACT_APP_PDF_API_URL || 'http://localhost:3001',
    ENDPOINTS: {
      FILES: '/api/pdf-files',
      CONVERT: '/api/convert-pdf',
      IMAGES: '/api/images'
    }
  },
  FILE_SERVER: {
    BASE_URL: process.env.REACT_APP_FILE_SERVER_URL || 'http://localhost:8000',
    ENDPOINTS: {
      UPLOAD: '/upload',
      DOWNLOAD: '/download',
      LIST: '/files'
    }
  },
  MAIN_APP: {
    BASE_URL: process.env.REACT_APP_BASE_URL || 'http://localhost:3005',
    ENDPOINTS: {
      HEALTH: '/health',
      API: '/api'
    }
  },
  PYTHON_CONVERTER: {
    BASE_URL: process.env.REACT_APP_PYTHON_CONVERTER_URL || 'http://localhost:3003',
    ENDPOINTS: {
      HEALTH: '/health',
      INFO: '/api/v1/info',
      EBCDIC_TO_ASCII: '/api/v1/convert/ebcdic-to-ascii',
      ASCII_TO_EBCDIC: '/api/v1/convert/ascii-to-ebcdic'
    }
  }
};

export const CORS_CONFIG = {
  ALLOWED_ORIGINS: [
    process.env.REACT_APP_BASE_URL || 'http://localhost:3005',
    process.env.REACT_APP_SMED_URL || 'http://localhost:3000',
    process.env.REACT_APP_ASP_MANAGER_URL || 'http://localhost:3007'
  ]
};