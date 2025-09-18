/**
 * API Constants
 * All API-related constants and endpoints
 */

export const API_ENDPOINTS = {
  HEALTH: '/api/health',
  FILES: {
    CONTENT: '/api/files/content',
    SEARCH: '/api/files/search',
    LIST: '/api/files/list'
  },
  CHAT: {
    SEND: '/api/chat/send',
    HISTORY: '/api/chat/history'
  }
};

export const FILE_EXTENSIONS = {
  READABLE: ['.md', '.txt', '.markdown', '.pdf'],
  SEARCHABLE: ['.md', '.txt', '.markdown'],
  SUPPORTED: ['.md', '.txt', '.markdown', '.pdf', '.doc', '.docx']
};

export const API_CONFIG = {
  TIMEOUTS: {
    DEFAULT: 30000,
    FILE_UPLOAD: 60000,
    SEARCH: 10000
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY: 1000
  },
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100
  }
};