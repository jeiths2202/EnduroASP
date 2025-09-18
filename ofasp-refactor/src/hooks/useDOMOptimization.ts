/**
 * DOM Optimization Hook
 * DOM最適化フック
 * 
 * 使用方法:
 * const { batchUpdates, measureLayout, optimizeReflow } = useDOMOptimization();
 * 
 * 機能:
 * - DOM update batching to minimize reflows
 * - Layout measurement optimization
 * - Reflow/repaint detection and optimization
 */

import { useCallback, useRef, useEffect } from 'react';

interface DOMUpdateBatch {
  reads: Array<() => any>;
  writes: Array<() => void>;
  callbacks: Array<() => void>;
}

interface LayoutMeasurement {
  width: number;
  height: number;
  top: number;
  left: number;
  timestamp: Date;
}

interface ReflowStats {
  batchedOperations: number;
  avoidedReflows: number;
  measurementCacheHits: number;
  totalBatchTime: number;
}

interface UseDOMOptimizationConfig {
  enableBatching?: boolean;
  enableMeasurementCache?: boolean;
  batchDelay?: number;
  cacheTimeout?: number;
  enableLogging?: boolean;
}

interface UseDOMOptimizationReturn {
  batchUpdates: (operations: {
    reads?: Array<() => any>;
    writes?: Array<() => void>;
    callback?: () => void;
  }) => Promise<any[]>;
  measureLayout: (element: Element, useCache?: boolean) => LayoutMeasurement;
  optimizeReflow: (callback: () => void) => void;
  scheduleWrite: (callback: () => void) => void;
  scheduleRead: <T>(callback: () => T) => Promise<T>;
  clearMeasurementCache: () => void;
  getOptimizationStats: () => ReflowStats;
}

// Configuration constants
const DOM_OPTIMIZATION_CONFIG = {
  DEFAULT_BATCH_DELAY: 16, // One frame at 60fps
  DEFAULT_CACHE_TIMEOUT: 1000,
  MAX_BATCH_SIZE: 50,
  MEASUREMENT_CACHE_SIZE: 100
} as const;

export const useDOMOptimization = (
  config: UseDOMOptimizationConfig = {}
): UseDOMOptimizationReturn => {
  const {
    enableBatching = true,
    enableMeasurementCache = true,
    batchDelay = DOM_OPTIMIZATION_CONFIG.DEFAULT_BATCH_DELAY,
    cacheTimeout = DOM_OPTIMIZATION_CONFIG.DEFAULT_CACHE_TIMEOUT,
    enableLogging = process.env.NODE_ENV === 'development'
  } = config;

  // Refs for persistent state
  const currentBatchRef = useRef<DOMUpdateBatch>({ reads: [], writes: [], callbacks: [] });
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const measurementCacheRef = useRef<Map<string, { measurement: LayoutMeasurement; expiry: number }>>(new Map());
  const statsRef = useRef<ReflowStats>({
    batchedOperations: 0,
    avoidedReflows: 0,
    measurementCacheHits: 0,
    totalBatchTime: 0
  });

  /**
   * バッチ更新実行
   * Execute batched updates
   */
  const executeBatch = useCallback(async (): Promise<any[]> => {
    const batch = currentBatchRef.current;
    const startTime = performance.now();

    if (batch.reads.length === 0 && batch.writes.length === 0) {
      return [];
    }

    const results: any[] = [];

    try {
      // Execute all reads first (batch DOM reads to minimize layout thrashing)
      if (batch.reads.length > 0) {
        batch.reads.forEach(read => {
          try {
            results.push(read());
          } catch (error) {
            console.error('[DOM Optimization] Read operation failed:', error);
            results.push(null);
          }
        });
      }

      // Execute all writes (batch DOM writes to minimize reflows)
      if (batch.writes.length > 0) {
        batch.writes.forEach(write => {
          try {
            write();
          } catch (error) {
            console.error('[DOM Optimization] Write operation failed:', error);
          }
        });
      }

      // Execute callbacks
      if (batch.callbacks.length > 0) {
        batch.callbacks.forEach(callback => {
          try {
            callback();
          } catch (error) {
            console.error('[DOM Optimization] Callback failed:', error);
          }
        });
      }

      // Update stats
      statsRef.current.batchedOperations += batch.reads.length + batch.writes.length;
      statsRef.current.avoidedReflows += Math.max(0, batch.writes.length - 1);
      statsRef.current.totalBatchTime += performance.now() - startTime;

      if (enableLogging) {
        console.debug(`[DOM Optimization] Executed batch: ${batch.reads.length} reads, ${batch.writes.length} writes in ${(performance.now() - startTime).toFixed(2)}ms`);
      }

    } finally {
      // Clear batch
      currentBatchRef.current = { reads: [], writes: [], callbacks: [] };
      batchTimeoutRef.current = null;
    }

    return results;
  }, [enableLogging]);

  /**
   * バッチ更新スケジュール
   * Schedule batch execution
   */
  const scheduleBatch = useCallback(() => {
    if (batchTimeoutRef.current || !enableBatching) {
      return;
    }

    batchTimeoutRef.current = setTimeout(() => {
      // Use requestAnimationFrame for optimal timing
      requestAnimationFrame(() => {
        executeBatch();
      });
    }, batchDelay);
  }, [executeBatch, enableBatching, batchDelay]);

  /**
   * バッチ更新メイン関数
   * Main batch updates function
   */
  const batchUpdates = useCallback(async (operations: {
    reads?: Array<() => any>;
    writes?: Array<() => void>;
    callback?: () => void;
  }): Promise<any[]> => {
    if (!enableBatching) {
      // Execute immediately if batching disabled
      const results: any[] = [];
      operations.reads?.forEach(read => results.push(read()));
      operations.writes?.forEach(write => write());
      operations.callback?.();
      return results;
    }

    // Add to current batch
    if (operations.reads) {
      currentBatchRef.current.reads.push(...operations.reads);
    }
    if (operations.writes) {
      currentBatchRef.current.writes.push(...operations.writes);
    }
    if (operations.callback) {
      currentBatchRef.current.callbacks.push(operations.callback);
    }

    // Check batch size limit
    const totalOperations = currentBatchRef.current.reads.length + 
                           currentBatchRef.current.writes.length +
                           currentBatchRef.current.callbacks.length;

    if (totalOperations >= DOM_OPTIMIZATION_CONFIG.MAX_BATCH_SIZE) {
      // Execute immediately if batch is full
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
        batchTimeoutRef.current = null;
      }
      return executeBatch();
    }

    scheduleBatch();

    // Return promise that resolves when batch executes
    return new Promise(resolve => {
      const originalCallback = operations.callback;
      currentBatchRef.current.callbacks[currentBatchRef.current.callbacks.length - 1] = () => {
        originalCallback?.();
        resolve([]);
      };
    });
  }, [enableBatching, executeBatch, scheduleBatch]);

  /**
   * レイアウト測定（キャッシュ付き）
   * Measure layout with caching
   */
  const measureLayout = useCallback((element: Element, useCache: boolean = true): LayoutMeasurement => {
    if (!element) {
      throw new Error('Element is required for layout measurement');
    }

    const elementKey = element.tagName + '_' + (element.id || element.className || '');
    const now = Date.now();

    // Check cache
    if (enableMeasurementCache && useCache) {
      const cached = measurementCacheRef.current.get(elementKey);
      if (cached && cached.expiry > now) {
        statsRef.current.measurementCacheHits++;
        return cached.measurement;
      }
    }

    // Measure layout
    const rect = element.getBoundingClientRect();
    const measurement: LayoutMeasurement = {
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
      timestamp: new Date()
    };

    // Cache measurement
    if (enableMeasurementCache && useCache) {
      // Limit cache size
      if (measurementCacheRef.current.size >= DOM_OPTIMIZATION_CONFIG.MEASUREMENT_CACHE_SIZE) {
        const oldestKey = measurementCacheRef.current.keys().next().value;
        measurementCacheRef.current.delete(oldestKey);
      }

      measurementCacheRef.current.set(elementKey, {
        measurement,
        expiry: now + cacheTimeout
      });
    }

    return measurement;
  }, [enableMeasurementCache, cacheTimeout]);

  /**
   * リフロー最適化
   * Optimize reflow operations
   */
  const optimizeReflow = useCallback((callback: () => void) => {
    if (enableBatching) {
      batchUpdates({ writes: [callback] });
    } else {
      // Use requestAnimationFrame for optimal timing
      requestAnimationFrame(callback);
    }
  }, [enableBatching, batchUpdates]);

  /**
   * 書き込み操作スケジュール
   * Schedule write operation
   */
  const scheduleWrite = useCallback((callback: () => void) => {
    if (enableBatching) {
      currentBatchRef.current.writes.push(callback);
      scheduleBatch();
    } else {
      requestAnimationFrame(callback);
    }
  }, [enableBatching, scheduleBatch]);

  /**
   * 読み取り操作スケジュール
   * Schedule read operation
   */
  const scheduleRead = useCallback(<T>(callback: () => T): Promise<T> => {
    if (enableBatching) {
      return new Promise(resolve => {
        currentBatchRef.current.reads.push(() => {
          const result = callback();
          resolve(result);
          return result;
        });
        scheduleBatch();
      });
    } else {
      return Promise.resolve(callback());
    }
  }, [enableBatching, scheduleBatch]);

  /**
   * 測定キャッシュクリア
   * Clear measurement cache
   */
  const clearMeasurementCache = useCallback(() => {
    measurementCacheRef.current.clear();
    
    if (enableLogging) {
      console.debug('[DOM Optimization] Measurement cache cleared');
    }
  }, [enableLogging]);

  /**
   * 最適化統計取得
   * Get optimization statistics
   */
  const getOptimizationStats = useCallback((): ReflowStats => {
    return { ...statsRef.current };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      measurementCacheRef.current.clear();
    };
  }, []);

  // Periodic cache cleanup
  useEffect(() => {
    if (!enableMeasurementCache) return;

    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const entriesToDelete: string[] = [];

      measurementCacheRef.current.forEach((value, key) => {
        if (value.expiry <= now) {
          entriesToDelete.push(key);
        }
      });

      entriesToDelete.forEach(key => {
        measurementCacheRef.current.delete(key);
      });

      if (enableLogging && entriesToDelete.length > 0) {
        console.debug(`[DOM Optimization] Cleaned up ${entriesToDelete.length} expired cache entries`);
      }
    }, cacheTimeout);

    return () => clearInterval(cleanupInterval);
  }, [enableMeasurementCache, cacheTimeout, enableLogging]);

  return {
    batchUpdates,
    measureLayout,
    optimizeReflow,
    scheduleWrite,
    scheduleRead,
    clearMeasurementCache,
    getOptimizationStats
  };
};