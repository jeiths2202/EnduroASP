/**
 * Timer Management Hook
 * タイマー管理フック
 * 
 * 使用方法:
 * const { startSystemTimer, cleanup } = useTimerManager();
 * 
 * 機能:
 * - Automatic timer cleanup on unmount
 * - Memory leak prevention
 * - Timer state management
 */

import { useEffect, useRef, useCallback } from 'react';
import { memoryLeakDetector } from '../utils/memoryLeakDetector';

interface UseTimerManagerReturn {
  startSystemTimer: (callback: () => void, interval?: number) => void;
  stopSystemTimer: () => void;
  startHeartbeat: (callback: () => void, interval?: number) => void;
  stopHeartbeat: () => void;
  cleanup: () => void;
  getActiveTimers: () => number;
}

// Configuration constants - no hardcoding
const TIMER_CONFIG = {
  SYSTEM_UPDATE_INTERVAL: 1000, // 1 second
  HEARTBEAT_INTERVAL: 15000, // 15 seconds
  CLEANUP_INTERVAL: 30000, // 30 seconds
} as const;

export const useTimerManager = (): UseTimerManagerReturn => {
  const systemTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const cleanupTimerRef = useRef<number | null>(null);

  /**
   * システム時刻更新タイマー開始
   * Start system time update timer
   */
  const startSystemTimer = useCallback((
    callback: () => void,
    interval: number = TIMER_CONFIG.SYSTEM_UPDATE_INTERVAL
  ) => {
    // Stop existing timer if any
    stopSystemTimer();
    
    systemTimerRef.current = memoryLeakDetector.registerInterval(
      callback,
      interval,
      'System time update timer'
    );
  }, []);

  /**
   * システムタイマー停止
   * Stop system timer
   */
  const stopSystemTimer = useCallback(() => {
    if (systemTimerRef.current !== null) {
      memoryLeakDetector.clearTimer(systemTimerRef.current);
      systemTimerRef.current = null;
    }
  }, []);

  /**
   * ハートビートタイマー開始
   * Start heartbeat timer
   */
  const startHeartbeat = useCallback((
    callback: () => void,
    interval: number = TIMER_CONFIG.HEARTBEAT_INTERVAL
  ) => {
    // Stop existing heartbeat if any
    stopHeartbeat();
    
    heartbeatTimerRef.current = memoryLeakDetector.registerInterval(
      callback,
      interval,
      'WebSocket heartbeat timer'
    );
  }, []);

  /**
   * ハートビート停止
   * Stop heartbeat timer
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current !== null) {
      memoryLeakDetector.clearTimer(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  /**
   * 全タイマークリーンアップ
   * Cleanup all timers
   */
  const cleanup = useCallback(() => {
    stopSystemTimer();
    stopHeartbeat();
    
    if (cleanupTimerRef.current !== null) {
      memoryLeakDetector.clearTimer(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
  }, [stopSystemTimer, stopHeartbeat]);

  /**
   * アクティブタイマー数取得
   * Get active timer count
   */
  const getActiveTimers = useCallback((): number => {
    return memoryLeakDetector.getDiagnostics().activeTimers;
  }, []);

  // Automatic cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Optional: Start periodic cleanup timer
  useEffect(() => {
    cleanupTimerRef.current = memoryLeakDetector.registerInterval(
      () => {
        // Periodic diagnostics check
        const diagnostics = memoryLeakDetector.getDiagnostics();
        if (diagnostics.activeTimers > 10) {
          console.warn('[Timer Manager] High timer count detected:', diagnostics);
        }
      },
      TIMER_CONFIG.CLEANUP_INTERVAL,
      'Timer diagnostics check'
    );

    return () => {
      if (cleanupTimerRef.current !== null) {
        memoryLeakDetector.clearTimer(cleanupTimerRef.current);
      }
    };
  }, []);

  return {
    startSystemTimer,
    stopSystemTimer,
    startHeartbeat,
    stopHeartbeat,
    cleanup,
    getActiveTimers
  };
};