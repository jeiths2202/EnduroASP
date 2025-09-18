/**
 * UI Constants
 * All UI-related constants including dimensions, delays, and limits
 */

export const UI_CONSTANTS = {
  TERMINAL: {
    DEFAULT_WIDTH: parseInt(process.env.REACT_APP_TERMINAL_DEFAULT_WIDTH) || 800,
    DEFAULT_HEIGHT: parseInt(process.env.REACT_APP_TERMINAL_DEFAULT_HEIGHT) || 600,
    MIN_WIDTH: parseInt(process.env.REACT_APP_TERMINAL_MIN_WIDTH) || 400,
    MIN_HEIGHT: parseInt(process.env.REACT_APP_TERMINAL_MIN_HEIGHT) || 300
  },
  ANIMATIONS: {
    DURATION: {
      FAST: parseInt(process.env.REACT_APP_ANIMATION_FAST) || 150,
      NORMAL: parseInt(process.env.REACT_APP_ANIMATION_NORMAL) || 300,
      SLOW: parseInt(process.env.REACT_APP_ANIMATION_SLOW) || 1500,
      POPUP: parseInt(process.env.REACT_APP_ANIMATION_POPUP) || 3000
    },
    DELAYS: {
      NONE: '0s',
      SHORT: process.env.REACT_APP_ANIMATION_DELAY_SHORT || '0.1s',
      MEDIUM: process.env.REACT_APP_ANIMATION_DELAY_MEDIUM || '0.2s'
    }
  },
  FILE_SIZES: {
    KILOBYTE: 1024,
    HISTORY_LIMIT: parseInt(process.env.REACT_APP_HISTORY_LIMIT) || 9
  },
  POLLING: {
    SIDEBAR_CHECK_INTERVAL: parseInt(process.env.REACT_APP_SIDEBAR_CHECK_INTERVAL) || 100
  }
};