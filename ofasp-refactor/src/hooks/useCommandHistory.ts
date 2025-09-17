/**
 * Command History Management Hook
 * コマンド履歴管理フック
 * 
 * 使用方法:
 * const { history, addCommand, clearHistory, getRecentHistory } = useCommandHistory();
 * 
 * 機能:
 * - Bounded array growth prevention
 * - Memory efficient history management
 * - Automatic cleanup on limits
 */

import { useState, useCallback, useMemo } from 'react';
import { memoryLeakDetector } from '../utils/memoryLeakDetector';

export interface CommandHistoryEntry {
  command: string;
  output: string;
  timestamp: Date;
  success: boolean;
}

interface UseCommandHistoryConfig {
  maxHistorySize?: number;
  maxRecentSize?: number;
}

interface UseCommandHistoryReturn {
  history: CommandHistoryEntry[];
  addCommand: (entry: Omit<CommandHistoryEntry, 'timestamp'>) => void;
  clearHistory: () => void;
  getRecentHistory: (size?: number) => CommandHistoryEntry[];
  getHistoryStats: () => {
    total: number;
    successful: number;
    failed: number;
    memoryUsage: string;
  };
}

// Configuration constants - no hardcoding
const DEFAULT_CONFIG = {
  MAX_HISTORY_SIZE: 100,
  MAX_RECENT_SIZE: 10,
  MEMORY_CHECK_THRESHOLD: 50,
} as const;

export const useCommandHistory = (
  config: UseCommandHistoryConfig = {}
): UseCommandHistoryReturn => {
  const {
    maxHistorySize = DEFAULT_CONFIG.MAX_HISTORY_SIZE,
    maxRecentSize = DEFAULT_CONFIG.MAX_RECENT_SIZE
  } = config;

  const [history, setHistory] = useState<CommandHistoryEntry[]>([]);

  /**
   * コマンド追加（メモリセーフ）
   * Add command with memory safety
   */
  const addCommand = useCallback((
    entry: Omit<CommandHistoryEntry, 'timestamp'>
  ) => {
    const newEntry: CommandHistoryEntry = {
      ...entry,
      timestamp: new Date()
    };

    setHistory(currentHistory => {
      const updatedHistory = [...currentHistory, newEntry];
      
      // Apply memory leak detector's array size limiting
      return memoryLeakDetector.limitArraySize(updatedHistory, maxHistorySize);
    });
  }, [maxHistorySize]);

  /**
   * 履歴クリア
   * Clear history
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  /**
   * 最近の履歴取得
   * Get recent history
   */
  const getRecentHistory = useCallback((
    size: number = maxRecentSize
  ): CommandHistoryEntry[] => {
    return history.slice(-size);
  }, [history, maxRecentSize]);

  /**
   * 履歴統計情報
   * History statistics
   */
  const getHistoryStats = useCallback(() => {
    const total = history.length;
    const successful = history.filter(entry => entry.success).length;
    const failed = total - successful;
    
    // Estimate memory usage
    const avgEntrySize = 0.5; // KB estimate per entry
    const memoryUsageKB = total * avgEntrySize;
    const memoryUsage = memoryUsageKB < 1024 
      ? `${memoryUsageKB.toFixed(1)}KB`
      : `${(memoryUsageKB / 1024).toFixed(1)}MB`;

    return {
      total,
      successful,
      failed,
      memoryUsage
    };
  }, [history]);

  /**
   * メモリ効率的な最近のコマンド取得
   * Memory efficient recent commands with memoization
   */
  const memoizedRecentCommands = useMemo(() => {
    return getRecentHistory();
  }, [getRecentHistory]);

  // Memory usage warning
  if (history.length > DEFAULT_CONFIG.MEMORY_CHECK_THRESHOLD) {
    console.debug('[Command History] Memory check:', getHistoryStats());
  }

  return {
    history,
    addCommand,
    clearHistory,
    getRecentHistory,
    getHistoryStats
  };
};