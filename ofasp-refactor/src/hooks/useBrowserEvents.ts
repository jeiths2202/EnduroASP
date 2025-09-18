/**
 * Browser Event Management Hook
 * ブラウザイベント管理フック
 * 
 * 使用方法:
 * const { setupBeforeUnload, cleanup } = useBrowserEvents(cleanupCallback);
 * 
 * 機能:
 * - Automatic event listener cleanup
 * - Memory leak prevention for browser events
 * - Safe process cleanup on page unload
 */

import { useEffect, useCallback, useRef } from 'react';
import { memoryLeakDetector } from '../utils/memoryLeakDetector';

interface UseBrowserEventsConfig {
  enableBeforeUnload?: boolean;
  enableVisibilityChange?: boolean;
  enableFocusEvents?: boolean;
}

interface UseBrowserEventsReturn {
  setupBeforeUnload: (cleanupData: any) => void;
  setupVisibilityChange: (callback: (isVisible: boolean) => void) => void;
  setupFocusEvents: (onFocus: () => void, onBlur: () => void) => void;
  cleanup: () => void;
}

// Configuration constants
const BROWSER_EVENT_CONFIG = {
  BEACON_ENDPOINT: 'http://localhost:8000/api/cleanup-processes',
  BEACON_TIMEOUT: 5000,
  CLEANUP_REASON: {
    BEFORE_UNLOAD: 'browser_page_unload',
    VISIBILITY_CHANGE: 'page_visibility_change',
    FOCUS_LOST: 'page_focus_lost'
  }
} as const;

export const useBrowserEvents = (
  config: UseBrowserEventsConfig = {}
): UseBrowserEventsReturn => {
  const {
    enableBeforeUnload = true,
    enableVisibilityChange = false,
    enableFocusEvents = false
  } = config;

  const cleanupFunctionsRef = useRef<(() => void)[]>([]);
  const isCleanupExecutedRef = useRef<boolean>(false);

  /**
   * beforeunload イベント設定
   * Setup beforeunload event with proper cleanup
   */
  const setupBeforeUnload = useCallback((cleanupData: any) => {
    if (!enableBeforeUnload) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Prevent duplicate execution
      if (isCleanupExecutedRef.current) {
        return;
      }
      isCleanupExecutedRef.current = true;

      console.debug('[Browser Events] Page unloading, executing cleanup...');

      try {
        // Create cleanup request data
        const requestData = JSON.stringify({
          user: cleanupData.user || 'unknown',
          cleanup_mode: 'all_main_programs',
          reason: BROWSER_EVENT_CONFIG.CLEANUP_REASON.BEFORE_UNLOAD,
          timestamp: new Date().toISOString()
        });

        // Use Blob with correct Content-Type for sendBeacon
        const blob = new Blob([requestData], { type: 'application/json' });
        
        // Send beacon - non-blocking for page unload
        const beaconSent = navigator.sendBeacon(
          BROWSER_EVENT_CONFIG.BEACON_ENDPOINT,
          blob
        );

        if (!beaconSent) {
          console.warn('[Browser Events] Failed to send cleanup beacon');
        }
      } catch (error) {
        console.error('[Browser Events] Error sending cleanup beacon:', error);
      }
    };

    // Register event listener through memory leak detector
    const removeListener = memoryLeakDetector.addEventListener(
      window,
      'beforeunload',
      handleBeforeUnload
    );

    // Store cleanup function
    cleanupFunctionsRef.current.push(removeListener);
  }, [enableBeforeUnload]);

  /**
   * visibilitychange イベント設定
   * Setup visibility change event
   */
  const setupVisibilityChange = useCallback((
    callback: (isVisible: boolean) => void
  ) => {
    if (!enableVisibilityChange) return;

    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      callback(isVisible);
    };

    const removeListener = memoryLeakDetector.addEventListener(
      document,
      'visibilitychange',
      handleVisibilityChange
    );

    cleanupFunctionsRef.current.push(removeListener);
  }, [enableVisibilityChange]);

  /**
   * focus/blur イベント設定
   * Setup focus/blur events
   */
  const setupFocusEvents = useCallback((
    onFocus: () => void,
    onBlur: () => void
  ) => {
    if (!enableFocusEvents) return;

    const removeFocusListener = memoryLeakDetector.addEventListener(
      window,
      'focus',
      onFocus
    );

    const removeBlurListener = memoryLeakDetector.addEventListener(
      window,
      'blur',
      onBlur
    );

    cleanupFunctionsRef.current.push(removeFocusListener, removeBlurListener);
  }, [enableFocusEvents]);

  /**
   * 全イベントリスナークリーンアップ
   * Cleanup all event listeners
   */
  const cleanup = useCallback(() => {
    console.debug('[Browser Events] Cleaning up all browser event listeners');
    
    // Execute all cleanup functions
    cleanupFunctionsRef.current.forEach(cleanupFn => {
      try {
        cleanupFn();
      } catch (error) {
        console.error('[Browser Events] Error during cleanup:', error);
      }
    });

    // Clear cleanup functions array
    cleanupFunctionsRef.current.length = 0;
    
    // Reset cleanup execution flag
    isCleanupExecutedRef.current = false;
  }, []);

  // Automatic cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    setupBeforeUnload,
    setupVisibilityChange,
    setupFocusEvents,
    cleanup
  };
};