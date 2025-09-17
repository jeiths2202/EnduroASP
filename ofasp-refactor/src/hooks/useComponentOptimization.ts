/**
 * Component Optimization Hook
 * コンポーネント最適化フック
 * 
 * 使用方法:
 * const { memoizedValue, optimizedHandlers, renderStats } = useComponentOptimization();
 * 
 * 機能:
 * - Automatic memoization for expensive calculations
 * - Render optimization tracking
 * - Handler debouncing and throttling
 */

import { useMemo, useCallback, useRef, useState, useEffect } from 'react';

interface OptimizationConfig {
  enableMemoization?: boolean;
  enableRenderTracking?: boolean;
  debounceDelay?: number;
  throttleDelay?: number;
  maxMemoizedValues?: number;
}

interface RenderStats {
  renderCount: number;
  lastRenderTime: Date;
  averageRenderDuration: number;
  memoizationHitRate: number;
}

interface OptimizedHandlers {
  debounce: <T extends (...args: any[]) => void>(
    func: T,
    delay?: number
  ) => T;
  throttle: <T extends (...args: any[]) => void>(
    func: T,
    delay?: number
  ) => T;
  memoize: <T>(
    factory: () => T,
    deps: React.DependencyList,
    key?: string
  ) => T;
}

interface UseComponentOptimizationReturn {
  optimizedHandlers: OptimizedHandlers;
  renderStats: RenderStats;
  memoizedValue: <T>(factory: () => T, deps: React.DependencyList) => T;
  clearOptimizationCache: () => void;
  getOptimizationReport: () => {
    totalMemoizedValues: number;
    cacheHitRate: number;
    memoryUsage: string;
    recommendations: string[];
  };
}

// Configuration constants
const OPTIMIZATION_CONFIG = {
  DEFAULT_DEBOUNCE_DELAY: 300,
  DEFAULT_THROTTLE_DELAY: 100,
  MAX_MEMOIZED_VALUES: 20,
  RENDER_TRACKING_INTERVAL: 1000,
  MEMORY_WARNING_THRESHOLD: 50
} as const;

export const useComponentOptimization = (
  componentName: string,
  config: OptimizationConfig = {}
): UseComponentOptimizationReturn => {
  const {
    enableMemoization = true,
    enableRenderTracking = process.env.NODE_ENV === 'development',
    debounceDelay = OPTIMIZATION_CONFIG.DEFAULT_DEBOUNCE_DELAY,
    throttleDelay = OPTIMIZATION_CONFIG.DEFAULT_THROTTLE_DELAY,
    maxMemoizedValues = OPTIMIZATION_CONFIG.MAX_MEMOIZED_VALUES
  } = config;

  // Render tracking state
  const renderCountRef = useRef<number>(0);
  const renderTimesRef = useRef<number[]>([]);
  const memoizationCacheRef = useRef<Map<string, { value: any; hitCount: number }>>(new Map());
  const debouncedFunctionsRef = useRef<Map<string, any>>(new Map());
  const throttledFunctionsRef = useRef<Map<string, any>>(new Map());

  const [renderStats, setRenderStats] = useState<RenderStats>({
    renderCount: 0,
    lastRenderTime: new Date(),
    averageRenderDuration: 0,
    memoizationHitRate: 0
  });

  /**
   * デバウンス処理
   * Debounce function
   */
  const debounce = useCallback(<T extends (...args: any[]) => void>(
    func: T,
    delay: number = debounceDelay
  ): T => {
    const funcKey = func.toString();
    
    if (debouncedFunctionsRef.current.has(funcKey)) {
      return debouncedFunctionsRef.current.get(funcKey);
    }

    let timeoutId: NodeJS.Timeout;
    const debouncedFunction = ((...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    }) as T;

    debouncedFunctionsRef.current.set(funcKey, debouncedFunction);
    return debouncedFunction;
  }, [debounceDelay]);

  /**
   * スロットル処理
   * Throttle function
   */
  const throttle = useCallback(<T extends (...args: any[]) => void>(
    func: T,
    delay: number = throttleDelay
  ): T => {
    const funcKey = func.toString();
    
    if (throttledFunctionsRef.current.has(funcKey)) {
      return throttledFunctionsRef.current.get(funcKey);
    }

    let lastCall = 0;
    const throttledFunction = ((...args: any[]) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        func(...args);
      }
    }) as T;

    throttledFunctionsRef.current.set(funcKey, throttledFunction);
    return throttledFunction;
  }, [throttleDelay]);

  /**
   * 高度なメモ化
   * Advanced memoization with cache management
   */
  const memoize = useCallback(<T>(
    factory: () => T,
    deps: React.DependencyList,
    key?: string
  ): T => {
    if (!enableMemoization) {
      return factory();
    }

    const cacheKey = key || `${componentName}_${deps.join('_')}_${Date.now()}`;
    const cached = memoizationCacheRef.current.get(cacheKey);

    if (cached) {
      cached.hitCount++;
      return cached.value;
    }

    // Check cache size limit
    if (memoizationCacheRef.current.size >= maxMemoizedValues) {
      // Remove least recently used entries
      const entries = Array.from(memoizationCacheRef.current.entries());
      entries.sort((a, b) => a[1].hitCount - b[1].hitCount);
      const toRemove = entries.slice(0, Math.floor(maxMemoizedValues * 0.3));
      toRemove.forEach(([key]) => memoizationCacheRef.current.delete(key));
    }

    const value = factory();
    memoizationCacheRef.current.set(cacheKey, { value, hitCount: 1 });
    return value;
  }, [componentName, enableMemoization, maxMemoizedValues]);

  /**
   * 標準のuseMemoラッパー
   * Standard useMemo wrapper with tracking
   */
  const memoizedValue = useCallback(<T>(
    factory: () => T,
    deps: React.DependencyList
  ): T => {
    return useMemo(() => {
      const startTime = performance.now();
      const result = factory();
      const duration = performance.now() - startTime;
      
      if (enableRenderTracking && duration > 1) {
        console.debug(`[Optimization] ${componentName} memoization took ${duration.toFixed(2)}ms`);
      }
      
      return result;
    }, deps);
  }, [componentName, enableRenderTracking]);

  /**
   * キャッシュクリア
   * Clear optimization cache
   */
  const clearOptimizationCache = useCallback(() => {
    memoizationCacheRef.current.clear();
    debouncedFunctionsRef.current.clear();
    throttledFunctionsRef.current.clear();
    renderTimesRef.current.length = 0;
    renderCountRef.current = 0;
    
    console.debug(`[Optimization] ${componentName} cache cleared`);
  }, [componentName]);

  /**
   * 最適化レポート生成
   * Generate optimization report
   */
  const getOptimizationReport = useCallback(() => {
    const totalMemoizedValues = memoizationCacheRef.current.size;
    const totalHits = Array.from(memoizationCacheRef.current.values())
      .reduce((sum, entry) => sum + entry.hitCount, 0);
    const cacheHitRate = totalMemoizedValues > 0 
      ? (totalHits / (totalMemoizedValues + totalHits)) * 100 
      : 0;

    // Memory estimation
    const memoryEstimateKB = totalMemoizedValues * 0.2; // 200 bytes per cached value
    const memoryUsage = memoryEstimateKB < 1024 
      ? `${memoryEstimateKB.toFixed(1)}KB`
      : `${(memoryEstimateKB / 1024).toFixed(1)}MB`;

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (cacheHitRate < 30) {
      recommendations.push('Consider reducing memoization - low hit rate detected');
    }
    
    if (totalMemoizedValues > OPTIMIZATION_CONFIG.MEMORY_WARNING_THRESHOLD) {
      recommendations.push('High memory usage - consider clearing cache more frequently');
    }
    
    if (renderStats.renderCount > 100 && renderStats.averageRenderDuration > 5) {
      recommendations.push('Frequent re-renders detected - check dependency arrays');
    }

    if (recommendations.length === 0) {
      recommendations.push('Optimization is working well');
    }

    return {
      totalMemoizedValues,
      cacheHitRate: parseFloat(cacheHitRate.toFixed(2)),
      memoryUsage,
      recommendations
    };
  }, [renderStats]);

  // Render tracking effect
  useEffect(() => {
    if (!enableRenderTracking) return;

    renderCountRef.current++;
    const renderTime = Date.now();
    renderTimesRef.current.push(renderTime);

    // Keep only recent render times
    const recentRenders = renderTimesRef.current.slice(-10);
    renderTimesRef.current = recentRenders;

    // Calculate average render duration
    const durations = recentRenders.slice(1).map((time, index) => 
      time - recentRenders[index]
    );
    const averageRenderDuration = durations.length > 0 
      ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
      : 0;

    // Calculate memoization hit rate
    const totalHits = Array.from(memoizationCacheRef.current.values())
      .reduce((sum, entry) => sum + (entry.hitCount - 1), 0);
    const memoizationHitRate = memoizationCacheRef.current.size > 0
      ? (totalHits / memoizationCacheRef.current.size) * 100
      : 0;

    setRenderStats({
      renderCount: renderCountRef.current,
      lastRenderTime: new Date(renderTime),
      averageRenderDuration,
      memoizationHitRate
    });
  });

  const optimizedHandlers: OptimizedHandlers = {
    debounce,
    throttle,
    memoize
  };

  return {
    optimizedHandlers,
    renderStats,
    memoizedValue,
    clearOptimizationCache,
    getOptimizationReport
  };
};