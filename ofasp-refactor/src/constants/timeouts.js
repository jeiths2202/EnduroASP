/**
 * Timeout Constants
 * All timeout and delay values used throughout the application
 */

export const TIMEOUTS = {
  CONVERSION_DELAY: parseInt(process.env.REACT_APP_CONVERSION_DELAY) || 1500,
  ANIMATION_DELAY: parseInt(process.env.REACT_APP_ANIMATION_DELAY) || 300,
  FOCUS_DELAY: parseInt(process.env.REACT_APP_FOCUS_DELAY) || 100,
  EXECUTION_DELAY: parseInt(process.env.REACT_APP_EXECUTION_DELAY) || 2000,
  ASYNC_OPERATION_DELAY: parseInt(process.env.REACT_APP_ASYNC_OPERATION_DELAY) || 1000,
  SIDEBAR_CHECK_INTERVAL: parseInt(process.env.REACT_APP_SIDEBAR_CHECK_INTERVAL) || 100
};