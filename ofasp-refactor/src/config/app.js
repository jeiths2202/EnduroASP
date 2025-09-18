/**
 * Application Configuration
 * Main application settings and configuration
 */

export const APP_CONFIG = {
  SERVER: {
    PORT: process.env.REACT_APP_PORT || 3005,
    HOST: process.env.REACT_APP_HOST || '0.0.0.0',
    PROXY_URL: process.env.REACT_APP_PROXY_URL || 'http://localhost:8000'
  },
  LOCALE: {
    DEFAULT: process.env.REACT_APP_DEFAULT_LOCALE || 'ja-JP',
    DEFAULT_LANG: process.env.REACT_APP_DEFAULT_LANG || 'ja',
    DATE_FORMAT: {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }
  },
  FILE_FORMATS: {
    SUPPORTED_EXTENSIONS: ['.cob', '.cobol', '.cpy', '.copy', '.cl', '.cle', '.smed', '.txt'],
    FILE_SIZE_UNITS: ['Bytes', 'KB', 'MB', 'GB'],
    HISTORY_LIMIT: parseInt(process.env.REACT_APP_HISTORY_LIMIT) || 9
  },
  FEATURES: {
    ENABLE_PDF_CONVERTER: process.env.REACT_APP_ENABLE_PDF_CONVERTER === 'true',
    ENABLE_DEBUG_MODE: process.env.REACT_APP_ENABLE_DEBUG_MODE === 'true',
    ENABLE_ANALYTICS: process.env.REACT_APP_ENABLE_ANALYTICS === 'true'
  }
};